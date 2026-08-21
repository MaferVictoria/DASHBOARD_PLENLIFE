// Shopify (Admin API — GraphQL) connector — REAL implementation.
//
// Reads credentials from Vercel Environment Variables:
//   SHOPIFY_STORE_DOMAIN     → the *.myshopify.com domain (NOT the custom domain)
//   SHOPIFY_ADMIN_API_TOKEN  → the shpat_... token from your custom app
//   SHOPIFY_API_VERSION      → optional, defaults to 2026-07
//
// If credentials are missing, falls back to mock data (so `npm run dev`
// works locally without secrets). If credentials ARE present but a call
// fails, it throws — the API route surfaces that as a visible error instead
// of quietly showing fake numbers.
//
// IMPORTANT CAVEATS — please read before trusting these numbers blindly:
//
// 1. "New vs. returning customers" is an APPROXIMATION. Shopify doesn't
//    expose a simple "was this the customer's first order" flag on the
//    Order object via the Admin API. This code uses `customer.numberOfOrders`
//    (their LIFETIME order count as of right now) — if it equals 1, we call
//    the order "new". This is wrong for a customer whose first-ever order is
//    in this date range but who has ALSO ordered again since (their lifetime
//    count would be 2+, so they'd be miscounted as "returning" for what was
//    genuinely their first order at the time). For exact parity, cross-check
//    against Shopify Admin → Analytics → "First-time vs returning customer
//    sales" report, which does this correctly using order history.
//
// 2. "Total sales" / "Net sales" are approximated from `currentTotalPriceSet`
//    (gross, tax + shipping included, net of refunds) and
//    `currentSubtotalPriceSet` (product revenue net of discounts/returns,
//    excluding tax/shipping) respectively. This tracks Shopify's own
//    definitions closely but isn't guaranteed to match to the peso — Shopify's
//    own "Total sales" report also folds in things like duties and exact
//    gift-card handling that aren't fully replicated here.
//
// 3. Pagination has a hard safety cap (see PAGE_SIZE / maxPages below) so a
//    huge date range (like "Todo el histórico") can't hang a Vercel function
//    forever. If you hit the cap, you'll get a clear error instead of a
//    silent wrong number — at that point, the honest fix is to either narrow
//    the range or move this to a precomputed/cached approach (e.g. a nightly
//    job that aggregates and stores results) rather than live-aggregating
//    thousands of orders on every page load.
//
// 4. The Admin API funnel data (page views / add to cart) is NOT available
//    here — Shopify Orders don't carry session-level funnel data. That needs
//    Shopify's Analytics API (limited availability) or GA4. What Shopify's
//    Admin API CAN give us for real is checkouts started (via
//    abandonedCheckoutsCount, combined with completed orders) and purchases —
//    see getShopifyCheckoutFunnel() below. "Visitas a la página" and "Añadido
//    al carrito" are intentionally left out of that funnel rather than faked.
//
// 5. "Top estados" uses shippingAddress.province — the state/province name
//    as Shopify has it on file, which depends on how the customer typed/
//    selected it at checkout. Minor spelling/casing inconsistencies from
//    checkout data aren't normalized here.

import {
  mockShopifyTotals,
  mockMonthlySeries,
  mockTopStatesByMonth,
  mockTopProductsByMonth,
  mockNewCustomersMonthly,
  mockAbandonedCheckoutsCount,
} from '../mockData';
import { monthsSoFar, toISODate } from '../dateRanges';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Tunable safety limits. Not load-tested against Plenlife's real order
// volume — if you hit rate limits, lower PAGE_SIZE; if you hit the "too many
// orders" error on ranges that should be valid, raise maxPages carefully.
const PAGE_SIZE = 100;
const LINE_ITEMS_PER_ORDER = 25;

function hasCredentials() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_API_TOKEN);
}

function round(n) {
  return Math.round(n);
}

const ORDERS_QUERY = `
  query OrdersForDashboard($cursor: String, $queryString: String!, $pageSize: Int!, $lineItemCount: Int!) {
    orders(first: $pageSize, after: $cursor, query: $queryString, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          createdAt
          currentTotalPriceSet { shopMoney { amount } }
          currentSubtotalPriceSet { shopMoney { amount } }
          customer { numberOfOrders }
          shippingAddress { province }
          lineItems(first: $lineItemCount) {
            edges { node { title quantity discountedTotalSet { shopMoney { amount } } } }
          }
        }
      }
    }
  }
`;

async function shopifyGraphQL(query, variables) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;

  async function attempt() {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();
    return { res, json };
  }

  let { res, json } = await attempt();

  // Basic one-time retry on Shopify's leaky-bucket rate limit. This is not a
  // full backoff strategy — if you're consistently getting throttled, the
  // real fix is fewer/cheaper queries (smaller PAGE_SIZE, narrower ranges).
  const throttled = json?.errors?.some((e) => e.extensions?.code === 'THROTTLED');
  if (throttled) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ({ res, json } = await attempt());
  }

  if (!res.ok || json.errors) {
    const message = json?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`Shopify Admin API: ${message}`);
  }

  return json.data;
}

// Fetches every order in [since, until] (inclusive), paginated. Throws if the
// range has more than `maxPages * PAGE_SIZE` orders rather than silently
// returning a partial (and therefore wrong) total.
async function fetchOrdersInRange(since, until, { maxPages }) {
  const queryString = `created_at:>='${since}' AND created_at:<='${until}T23:59:59Z'`;
  let cursor = null;
  let hasNextPage = true;
  let page = 0;
  const orders = [];

  while (hasNextPage) {
    page += 1;
    if (page > maxPages) {
      throw new Error(
        `Shopify: este rango tiene más de ${maxPages * PAGE_SIZE} órdenes — demasiadas para agregar en una sola consulta. Acorta el rango, o cambia esto a un cálculo precomputado (cron job) en vez de en vivo.`
      );
    }
    const data = await shopifyGraphQL(ORDERS_QUERY, {
      cursor,
      queryString,
      pageSize: PAGE_SIZE,
      lineItemCount: LINE_ITEMS_PER_ORDER,
    });
    data.orders.edges.forEach((e) => orders.push(e.node));
    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }

  return orders;
}

function aggregateTotals(orders) {
  let totalSales = 0;
  let netSales = 0;
  let newCustomers = 0;
  let returningCustomers = 0;
  let newCustomerRevenue = 0;
  let returningCustomerRevenue = 0;
  let unknownCustomerOrders = 0;

  orders.forEach((o) => {
    const orderNetSales = Number(o.currentSubtotalPriceSet.shopMoney.amount);
    totalSales += Number(o.currentTotalPriceSet.shopMoney.amount);
    netSales += orderNetSales;

    // See caveat #1 at the top of this file re: this approximation.
    //
    // A customer who just placed THIS order must have numberOfOrders >= 1 —
    // there is no legitimate case where it's 0 or missing. If Shopify gives
    // us null/0/NaN here, that means it didn't give us usable customer data
    // for this order (no customer object, or the field came back
    // restricted) — NOT that the customer is "returning". Silently
    // bucketing those as returning was the bug: it could crush the
    // new-customer count toward zero and blow up blended CAC.
    const lifetimeOrders = o.customer ? Number(o.customer.numberOfOrders) : null;
    if (lifetimeOrders === null || Number.isNaN(lifetimeOrders) || lifetimeOrders <= 0) {
      unknownCustomerOrders += 1;
    } else if (lifetimeOrders === 1) {
      newCustomers += 1;
      newCustomerRevenue += orderNetSales;
    } else {
      returningCustomers += 1;
      returningCustomerRevenue += orderNetSales;
    }
  });

  if (unknownCustomerOrders > 0) {
    const pct = ((unknownCustomerOrders / orders.length) * 100).toFixed(0);
    console.warn(
      `[shopify connector] ${unknownCustomerOrders}/${orders.length} orders (${pct}%) had no usable ` +
        `customer.numberOfOrders — excluded from the new/returning split rather than guessed. If this ` +
        `percentage is high, check whether this Shopify app has "protected customer data" access approved; ` +
        `that can cause customer fields to come back empty/restricted.`
    );
  }

  return {
    totalSales: round(totalSales),
    netSales: round(netSales),
    orders: orders.length,
    newCustomers,
    returningCustomers,
    newCustomerRevenue: round(newCustomerRevenue),
    returningCustomerRevenue: round(returningCustomerRevenue),
    unknownCustomerOrders,
  };
}

function monthLabelFor(dateStr) {
  return MONTH_LABELS[new Date(dateStr).getMonth()];
}

function buildTopStatesByMonth(orders, monthLabels) {
  const byMonth = {}; // { [month]: { [state]: sales } }
  orders.forEach((o) => {
    const month = monthLabelFor(o.createdAt);
    if (!monthLabels.includes(month)) return;
    const state = o.shippingAddress?.province || 'Sin estado';
    const sales = Number(o.currentSubtotalPriceSet.shopMoney.amount);
    byMonth[month] = byMonth[month] || {};
    byMonth[month][state] = (byMonth[month][state] || 0) + sales;
  });

  return monthLabels.map((month) => {
    const states = Object.entries(byMonth[month] || {})
      .map(([state, sales]) => ({ state, sales: round(sales) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    return { month, states };
  });
}

function buildTopProductsByMonth(orders, monthLabels) {
  const byMonth = {}; // { [month]: { [product]: sales } }
  orders.forEach((o) => {
    const month = monthLabelFor(o.createdAt);
    if (!monthLabels.includes(month)) return;
    byMonth[month] = byMonth[month] || {};
    o.lineItems.edges.forEach(({ node: item }) => {
      const revenue = Number(item.discountedTotalSet.shopMoney.amount);
      byMonth[month][item.title] = (byMonth[month][item.title] || 0) + revenue;
    });
  });

  return monthLabels.map((month) => {
    const products = Object.entries(byMonth[month] || {})
      .map(([product, sales]) => ({ product, sales: round(sales) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    return { month, products };
  });
}

// In-flight memoization so a single request that calls BOTH
// getShopifyTopCitiesByMonth() and getShopifyTopProductsByMonth() (which the
// /api/shopify route does, via Promise.all) fetches the shared 3-month order
// window ONCE instead of twice.
let _recentOrdersPromise = null;
let _recentOrdersPromiseAt = 0;

function getRecentOrdersOnce() {
  const now = Date.now();
  if (_recentOrdersPromise && now - _recentOrdersPromiseAt < 5000) {
    return _recentOrdersPromise;
  }
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 2, 1); // last 3 months
  _recentOrdersPromiseAt = now;
  _recentOrdersPromise = fetchOrdersInRange(toISODate(start), toISODate(today), { maxPages: 30 });
  return _recentOrdersPromise;
}

// Same in-flight memoization pattern as getRecentOrdersOnce() below, but for
// the full-year window — getShopifyMonthly() and getShopifyNewCustomersMonthly()
// both need "every order so far this year" and calling both (which the
// /api/shopify route does via Promise.all) shouldn't fetch that twice.
let _yearlyOrdersPromise = null;
let _yearlyOrdersPromiseAt = 0;

function getYearlyOrdersOnce() {
  const now = Date.now();
  if (_yearlyOrdersPromise && now - _yearlyOrdersPromiseAt < 5000) {
    return _yearlyOrdersPromise;
  }
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  _yearlyOrdersPromiseAt = now;
  _yearlyOrdersPromise = fetchOrdersInRange(yearStart, toISODate(today), { maxPages: 60 });
  return _yearlyOrdersPromise;
}

export async function getShopifyTotals(start, end) {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing SHOPIFY_STORE_DOMAIN/SHOPIFY_ADMIN_API_TOKEN — using mock data.');
    return mockShopifyTotals(start, end);
  }
  const orders = await fetchOrdersInRange(start, end, { maxPages: 20 });
  return aggregateTotals(orders);
}

export async function getShopifyMonthly() {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockMonthlySeries('shopify');
  }
  const now = new Date();
  const months = monthsSoFar(now);

  let orders;
  try {
    orders = await getYearlyOrdersOnce();
  } catch (err) {
    console.error('[shopify connector] monthly aggregation failed:', err.message);
    // Same "gap, not zero" convention as the Meta connector's monthly chart.
    return months.map((m) => ({ month: m, value: null }));
  }

  const byMonth = {};
  orders.forEach((o) => {
    const month = monthLabelFor(o.createdAt);
    byMonth[month] = (byMonth[month] || 0) + Number(o.currentSubtotalPriceSet.shopMoney.amount);
  });

  return months.map((month) => ({ month, value: round(byMonth[month] || 0) }));
}

// New customers acquired per month, and the value of THEIR orders — same
// new-customer criterion as aggregateTotals() above (numberOfOrders === 1,
// with 0/null/NaN excluded as "unknown" rather than guessed as returning).
export async function getShopifyNewCustomersMonthly() {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockNewCustomersMonthly();
  }
  const now = new Date();
  const months = monthsSoFar(now);

  let orders;
  try {
    orders = await getYearlyOrdersOnce();
  } catch (err) {
    console.error('[shopify connector] new-customers monthly aggregation failed:', err.message);
    return months.map((m) => ({ month: m, count: null, value: null }));
  }

  const byMonth = {};
  orders.forEach((o) => {
    const lifetimeOrders = o.customer ? Number(o.customer.numberOfOrders) : null;
    const isNew = lifetimeOrders !== null && !Number.isNaN(lifetimeOrders) && lifetimeOrders === 1;
    if (!isNew) return; // excludes both "returning" and "unknown" orders
    const month = monthLabelFor(o.createdAt);
    if (!byMonth[month]) byMonth[month] = { count: 0, value: 0 };
    byMonth[month].count += 1;
    byMonth[month].value += Number(o.currentSubtotalPriceSet.shopMoney.amount);
  });

  return months.map((month) => {
    const bucket = byMonth[month] || { count: 0, value: 0 };
    return { month, count: bucket.count, value: round(bucket.value) };
  });
}

// Real version: aggregates actual Shopify orders by shipping state/province,
// grouped by month (current + previous month). Do NOT pull this from Meta or
// Google — they don't have it.
export async function getShopifyTopStatesByMonth() {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockTopStatesByMonth();
  }
  const monthLabels = monthsSoFar(new Date()).slice(-2);
  const orders = await getRecentOrdersOnce();
  return buildTopStatesByMonth(orders, monthLabels);
}

// Real version: aggregates actual Shopify order line items by product title,
// grouped by month (last 2 months). Do NOT pull product data from Meta or
// Google — they don't have it.
export async function getShopifyTopProductsByMonth() {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockTopProductsByMonth();
  }
  const monthLabels = monthsSoFar(new Date()).slice(-2);
  const orders = await getRecentOrdersOnce();
  return buildTopProductsByMonth(orders, monthLabels);
}

// How many checkouts were started but never completed in this range. This is
// a genuinely real Shopify number (unlike the old mock funnel) — used both as
// its own "carritos abandonados" stat and as one half of the checkout funnel
// below (checkouts started = abandoned + completed).
//
// NOTE: per Shopify's docs, abandonedCheckoutsCount requires the read_orders
// scope AND the "manage_abandoned_checkouts" permission on this app — if you
// see a permission error here, that's almost certainly it (add that
// permission in your custom app's Admin API scopes).
export async function getShopifyAbandonedCheckoutsCount(start, end) {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockAbandonedCheckoutsCount(start, end);
  }
  const queryString = `created_at:>='${start}' AND created_at:<='${end}T23:59:59Z'`;
  const query = `
    query AbandonedCheckoutsCount($queryString: String) {
      abandonedCheckoutsCount(query: $queryString) { count precision }
    }
  `;
  const data = await shopifyGraphQL(query, { queryString });
  return data.abandonedCheckoutsCount?.count || 0;
}

// The 2-step checkout funnel (checkouts started → purchases) is computed in
// app/api/shopify/route.js directly from getShopifyAbandonedCheckoutsCount()
// + totals.orders, rather than as a separate function here — both of those
// are already being fetched for other reasons in the same request, so doing
// it inline avoids fetching abandoned checkouts twice.
