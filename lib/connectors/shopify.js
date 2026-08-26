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
//
// 6. Cancelled orders and test-mode orders are EXCLUDED (fetchOrdersInRange
//    filters out any order where cancelledAt is set or test is true). This
//    was a real bug found in production: cancelled orders were being
//    counted at full value toward "ventas netas", inflating totals well
//    above what Shopify's own reports showed.
//
// 7. ⚠️ SHOPIFY'S 60-DAY ORDER HISTORY LIMIT: by default, an app can only
//    see orders from the last 60 days via the Order object, UNLESS it has
//    been granted the `read_all_orders` scope (an approval Shopify reviews
//    separately from your other scopes). If this app doesn't have that
//    scope, any range reaching further back than 60 days — including
//    "Todo el histórico" and the Jan-to-date monthly charts once the year
//    is more than ~2 months old — will silently come back with FEWER
//    orders than actually exist, not an error. If numbers still look off
//    after the cancelled-orders fix (point 6), especially for older
//    months, check whether this app has `read_all_orders` approved in your
//    Shopify Partner/app settings.
//
// 8. `currentSubtotalPriceSet`/`currentTotalPriceSet` are SUPPOSED to
//    reflect refunds, but Shopify merchants have reported cases (see
//    Shopify's own developer community) where these fields don't update
//    correctly after certain refund flows. If your numbers are still off
//    after fixes #6/#7, a heavily-refunded order not reflecting its refund
//    in these fields is the next thing to suspect — that would need
//    cross-referencing the `refunds` field on the order, which isn't
//    implemented here yet.
//
// 9. ⚠️ TIMEZONE: Shopify's GraphQL Admin API always returns/filters order
//    timestamps in UTC — this is a well-documented mismatch versus Shopify's
//    own native Reports/Analytics, which bucket sales by the STORE's local
//    calendar day. Left uncorrected, this causes exactly the kind of
//    discrepancy you'd see comparing this dashboard against a Shopify
//    "Informes" report with the same nominal date range: orders placed late
//    at night (local time) land in the wrong day in UTC, and near the start/
//    end of a selected range, whole orders can be included or excluded
//    incorrectly. Fixed here by: (a) querying Shopify for a 1-day-padded
//    window so nothing near the boundary gets missed, then (b) converting
//    each order's createdAt to the store's local calendar date
//    (SHOPIFY_STORE_TIMEZONE env var, defaults to America/Mexico_City) and
//    filtering precisely by THAT date. Set SHOPIFY_STORE_TIMEZONE explicitly
//    if Plenlife's store is ever configured to a different zone.
//
// 10. ⚠️ TAX-INCLUSIVE PRICING: confirmed empirically (client compared this
//     dashboard against Shopify's own "Informes" report, Aug 2026) that
//     Plenlife's store has `taxesIncluded = true` — meaning
//     currentSubtotalPriceSet and line-item prices carry the 16% IVA baked
//     in, NOT excluded like a "subtotal" normally implies. Every "net sales"
//     figure in this file (order totals, monthly, top estados, top
//     productos) now divides by (1 + SHOPIFY_TAX_RATE) — default 0.16 —
//     whenever an order has taxesIncluded=true, via netAmountFromGross().
//     This is a RATE-BASED approximation, not reading Shopify's actual tax
//     line amount per order (that would need `currentTotalTaxSet`, whose
//     exact field name on Order wasn't confirmed with enough certainty to
//     risk the whole query breaking on a wrong guess — see git history/ask
//     Claude to revisit this if Plenlife ever has mixed tax rates, tax-
//     exempt orders, or the rate changes). "Total sales"
//     (currentTotalPriceSet) is UNCHANGED — it's supposed to include tax,
//     that's its definition.

import {
  mockShopifyTotals,
  mockMonthlySeries,
  mockTopStatesByMonth,
  mockTopProductsByMonth,
  mockNewCustomersMonthly,
  mockAbandonedCheckoutsCount,
} from '../mockData';
import { monthsSoFar, toISODate, getPreviousRange } from '../dateRanges';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
// See caveat #9 above. Defaults to Mexico City time (UTC-6 year-round since
// Mexico dropped DST nationally in 2022) since that's virtually certainly
// correct for Plenlife — override via env var if that's ever wrong.
const STORE_TIMEZONE = process.env.SHOPIFY_STORE_TIMEZONE || 'America/Mexico_City';

// Tunable safety limits. Not load-tested against Plenlife's real order
// volume — if you hit rate limits, lower PAGE_SIZE; if you hit the "too many
// orders" error on ranges that should be valid, raise maxPages carefully.
const PAGE_SIZE = 100;
const LINE_ITEMS_PER_ORDER = 25;

function hasCredentials() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_API_TOKEN);
}

// Converts a UTC ISO timestamp (what Shopify always returns) to the store's
// local calendar date, as YYYY-MM-DD — this is what should be compared
// against the user-selected date range, not the raw UTC date.
function toLocalISODate(utcISOString) {
  const date = new Date(utcISOString);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
          cancelledAt
          test
          taxesIncluded
          currentTotalPriceSet { shopMoney { amount } }
          currentSubtotalPriceSet { shopMoney { amount } }
          customer { numberOfOrders }
          shippingAddress { province }
          lineItems(first: $lineItemCount) {
            edges {
              node {
                title
                quantity
                originalTotalSet { shopMoney { amount } }
                discountedTotalSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

// See caveat #10 below. When an order has taxesIncluded=true, Shopify's
// subtotal/line-item prices carry the tax baked in — this backs it out
// using the store's known tax rate, to match Shopify's own "Net sales"
// definition (which always excludes tax, even when prices displayed to
// the customer include it).
const TAX_RATE = Number(process.env.SHOPIFY_TAX_RATE || '0.16'); // Mexico IVA

function netAmountFromGross(grossAmount, taxesIncluded) {
  return taxesIncluded ? grossAmount / (1 + TAX_RATE) : grossAmount;
}

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
  // See caveat #9 at the top of this file — Shopify's query filter is UTC,
  // but we want the store's LOCAL calendar day. Pad the request window by a
  // day on each side so nothing near midnight gets missed by the UTC filter,
  // then filter precisely by local date below once we have real timestamps.
  const paddedSince = addDaysISO(since, -1);
  const paddedUntil = addDaysISO(until, 1);
  const queryString = `created_at:>='${paddedSince}' AND created_at:<='${paddedUntil}T23:59:59Z'`;
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

  // Now filter precisely by the store's local calendar date — this is the
  // fix for caveat #9. Without this, the 1-day padding above would just
  // silently over-include orders from the adjacent days.
  const inLocalRange = orders.filter((o) => {
    const localDate = toLocalISODate(o.createdAt);
    return localDate >= since && localDate <= until;
  });

  // See caveat #6 at the top of this file — a cancelled order isn't a sale,
  // and test-mode orders (Bogus Gateway / dev store checkouts) aren't real
  // either. Filtering here means every function that calls
  // fetchOrdersInRange (totals, monthly, top states/products, new
  // customers) gets clean data automatically, with nothing to remember
  // per-caller.
  const before = inLocalRange.length;
  const clean = inLocalRange.filter((o) => !o.cancelledAt && !o.test);
  const excluded = before - clean.length;
  if (excluded > 0) {
    console.warn(
      `[shopify connector] Excluded ${excluded}/${before} orders (cancelled or test-mode) from ${since} to ${until}.`
    );
  }

  return clean;
}

function aggregateTotals(orders) {
  let totalSales = 0;
  let netSales = 0;
  let grossSales = 0;
  let newCustomers = 0;
  let returningCustomers = 0;
  let newCustomerRevenue = 0;
  let returningCustomerRevenue = 0;
  let unknownCustomerOrders = 0;

  orders.forEach((o) => {
    const orderNetSales = netAmountFromGross(Number(o.currentSubtotalPriceSet.shopMoney.amount), o.taxesIncluded);
    // Gross sales = line items at their ORIGINAL (pre-discount) price — same
    // tax handling as everything else, since original prices carry the same
    // embedded tax as discounted ones when taxesIncluded is true.
    const orderGrossSales = netAmountFromGross(
      o.lineItems.edges.reduce((sum, e) => sum + Number(e.node.originalTotalSet.shopMoney.amount), 0),
      o.taxesIncluded
    );
    totalSales += Number(o.currentTotalPriceSet.shopMoney.amount);
    netSales += orderNetSales;
    grossSales += orderGrossSales;

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
    grossSales: round(grossSales),
    orders: orders.length,
    newCustomers,
    returningCustomers,
    newCustomerRevenue: round(newCustomerRevenue),
    returningCustomerRevenue: round(returningCustomerRevenue),
    unknownCustomerOrders,
  };
}

function monthLabelFor(dateStr) {
  // Same fix as fetchOrdersInRange: bucket by the store's local calendar
  // month, not whatever timezone the server happens to run in (Vercel's
  // Node runtime is UTC, which would silently shift late-night orders into
  // the wrong month otherwise).
  const localDate = toLocalISODate(dateStr);
  const monthIndex = Number(localDate.slice(5, 7)) - 1;
  return MONTH_LABELS[monthIndex];
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

// Shared in-flight memoization keyed by exact start/end — getShopifyTotals(),
// getShopifyTopStatesByMonth(), and getShopifyTopProductsByMonth() are all
// called for the SAME selected range in the same request, so this avoids
// fetching the same orders from Shopify three times.
let _rangeOrdersCache = { key: null, promise: null, at: 0 };

function getOrdersForRangeOnce(start, end, maxPages) {
  const key = `${start}|${end}`;
  const now = Date.now();
  if (_rangeOrdersCache.key === key && now - _rangeOrdersCache.at < 5000) {
    return _rangeOrdersCache.promise;
  }
  _rangeOrdersCache = { key, at: now, promise: fetchOrdersInRange(start, end, { maxPages }) };
  return _rangeOrdersCache.promise;
}

export async function getShopifyTotals(start, end) {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing SHOPIFY_STORE_DOMAIN/SHOPIFY_ADMIN_API_TOKEN — using mock data.');
    return mockShopifyTotals(start, end);
  }
  const orders = await getOrdersForRangeOnce(start, end, 20);
  return aggregateTotals(orders);
}

// Top estados — live Shopify data, respecting whatever date range is
// selected (this used to read from a Google Sheet the client maintained by
// hand; reverted back to live Shopify per their request, to avoid sharing
// that whole spreadsheet — see README for the history). Excludes
// cancelled/test orders automatically via fetchOrdersInRange's filter.
// Aggregates {state: sales} totals for a given order set — shared by both
// the current-period and previous-period passes below.
function sumSalesByState(orders) {
  const totals = {};
  orders.forEach((o) => {
    const state = o.shippingAddress?.province;
    if (!state) return;
    const sales = netAmountFromGross(Number(o.currentSubtotalPriceSet.shopMoney.amount), o.taxesIncluded);
    totals[state] = (totals[state] || 0) + sales;
  });
  return totals;
}

export async function getShopifyTopStatesByMonth(start, end) {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockTopStatesByMonth(start, end);
  }
  const orders = await getOrdersForRangeOnce(start, end, 20);

  const orderCounts = {}; // { [state]: orderCount }
  orders.forEach((o) => {
    const state = o.shippingAddress?.province;
    if (!state) return;
    orderCounts[state] = (orderCounts[state] || 0) + 1;
  });
  const currentTotals = sumSalesByState(orders);

  // Previous-equivalent period, for the per-item "% vs. anterior" — a best
  // effort: if this fetch fails, comparisons are just omitted (null), it
  // shouldn't block showing the current period's real numbers.
  let previousTotals = {};
  const prevRange = getPreviousRange({ id: 'custom', start, end });
  if (prevRange) {
    try {
      const prevOrders = await getOrdersForRangeOnce(prevRange.start, prevRange.end, 20);
      previousTotals = sumSalesByState(prevOrders);
    } catch (err) {
      console.warn('[shopify connector] top-states previous-period comparison failed:', err.message);
    }
  }

  const states = Object.entries(currentTotals)
    .map(([state, sales]) => ({
      state,
      sales: round(sales),
      orders: orderCounts[state] || 0,
      previousSales: state in previousTotals ? round(previousTotals[state]) : null,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return [{ start, end, states }];
}

// Top productos — same pattern, aggregating line items instead of order
// totals so a multi-product order attributes revenue to each product it
// contains, not the whole order to just one.
//
// BUG FIXED (26 ago 2026): Shopify's LineItem type has no "current" /
// refund-adjusted variant of discountedTotalSet — only the ORDER level
// (currentSubtotalPriceSet) reflects returns. Without correcting for this,
// a partially-refunded order kept showing its products at their full
// original value here, while every other "ventas netas" figure in the
// dashboard (KPIs, Top Estados) already excluded that returned amount —
// so this table read as gross, not net, exactly as flagged.
//
// Fix: for each order, compare the sum of its line items' discountedTotalSet
// against the order's own currentSubtotalPriceSet (which DOES reflect
// returns). Any gap between them is treated as a refund, and distributed
// proportionally across that order's line items — Shopify doesn't expose
// which specific item was returned, so proportional distribution across
// the order is the closest available approximation, not an exact
// per-item figure.
function sumSalesByProduct(orders) {
  const totals = {};
  orders.forEach((o) => {
    const lineItemsRawSum = o.lineItems.edges.reduce(
      (sum, e) => sum + Number(e.node.discountedTotalSet.shopMoney.amount),
      0
    );
    const orderRawSubtotal = Number(o.currentSubtotalPriceSet.shopMoney.amount);
    // Both sides are in the SAME (still tax-inclusive-if-applicable) units
    // here, so the ratio is valid before netAmountFromGross() is applied —
    // dividing both sides by the same tax factor wouldn't change the ratio
    // anyway, but computing it pre-tax-adjustment keeps this simpler.
    const refundRatio = lineItemsRawSum > 0 ? orderRawSubtotal / lineItemsRawSum : 1;

    o.lineItems.edges.forEach(({ node: item }) => {
      const rawItemRevenue = Number(item.discountedTotalSet.shopMoney.amount) * refundRatio;
      const revenue = netAmountFromGross(rawItemRevenue, o.taxesIncluded);
      totals[item.title] = (totals[item.title] || 0) + revenue;
    });
  });
  return totals;
}

export async function getShopifyTopProductsByMonth(start, end) {
  if (!hasCredentials()) {
    console.warn('[shopify connector] Missing credentials — using mock data.');
    return mockTopProductsByMonth(start, end);
  }
  const orders = await getOrdersForRangeOnce(start, end, 20);

  const unitCounts = {}; // { [product]: units }
  orders.forEach((o) => {
    o.lineItems.edges.forEach(({ node: item }) => {
      unitCounts[item.title] = (unitCounts[item.title] || 0) + (Number(item.quantity) || 0);
    });
  });
  const currentTotals = sumSalesByProduct(orders);

  let previousTotals = {};
  const prevRange = getPreviousRange({ id: 'custom', start, end });
  if (prevRange) {
    try {
      const prevOrders = await getOrdersForRangeOnce(prevRange.start, prevRange.end, 20);
      previousTotals = sumSalesByProduct(prevOrders);
    } catch (err) {
      console.warn('[shopify connector] top-products previous-period comparison failed:', err.message);
    }
  }

  const products = Object.entries(currentTotals)
    .map(([product, sales]) => ({
      product,
      sales: round(sales),
      units: unitCounts[product] || 0,
      previousSales: product in previousTotals ? round(previousTotals[product]) : null,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return [{ start, end, products }];
}

// Returns {month, sales, orders} — net sales AND order count per month, from
// the same yearly order fetch (no extra API calls for the order count).
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
    return months.map((m) => ({ month: m, sales: null, orders: null }));
  }

  const byMonth = {};
  orders.forEach((o) => {
    const month = monthLabelFor(o.createdAt);
    if (!byMonth[month]) byMonth[month] = { sales: 0, orders: 0 };
    byMonth[month].sales += netAmountFromGross(Number(o.currentSubtotalPriceSet.shopMoney.amount), o.taxesIncluded);
    byMonth[month].orders += 1;
  });

  return months.map((month) => {
    const bucket = byMonth[month] || { sales: 0, orders: 0 };
    return { month, sales: round(bucket.sales), orders: bucket.orders };
  });
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
