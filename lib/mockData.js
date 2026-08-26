// Deterministic mock data generator.
//
// This exists ONLY so the dashboard is fully navigable before real API
// credentials are wired up. Every function here has a matching function in
// lib/connectors/*.js that is meant to REPLACE it once Meta/Google/Shopify
// credentials exist. Nothing here should ship to production untouched.

import { monthsSoFar, daysBetween } from './dateRanges';

// Simple seeded RNG (mulberry32) so numbers stay stable for a given
// start/end/platform combination instead of jumping around on every render.
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function rngFor(...parts) {
  return seedFromString(parts.join('|'));
}

function round(n) {
  return Math.round(n);
}

const PRODUCTS = [
  'Fórmula BR+ Chocolate',
  'Fórmula BR+ Vainilla',
  'Fórmula BR+ Fresa',
  'Fórmula Adulto 50',
  'Proteína Clara',
  'Proteína Keto',
  'Multivitamínico',
  'Gomitas Biotina',
  'Gomitas Calcio',
  'Kit Sachets Proteínas',
];

const STATES = [
  'Nuevo León', 'Ciudad de México', 'Jalisco', 'Puebla', 'Querétaro',
  'Baja California', 'Yucatán', 'Guanajuato', 'Estado de México', 'San Luis Potosí',
];

export function mockMetaTotals(start, end) {
  const rnd = rngFor('meta', start, end);
  const days = daysBetween(start, end);
  const spend = round((900 + rnd() * 400) * days);
  const roas = 2.2 + rnd() * 1.8;
  const purchaseValue = round(spend * roas);
  const purchases = round(purchaseValue / (450 + rnd() * 150));
  const cpa = purchases > 0 ? spend / purchases : 0;
  return { spend, purchases, purchaseValue, roas, cpa };
}

export function mockGoogleTotals(start, end) {
  const rnd = rngFor('google', start, end);
  const days = daysBetween(start, end);
  const spend = round((700 + rnd() * 350) * days);
  const roas = 2.6 + rnd() * 2.0;
  const conversionValue = round(spend * roas);
  const conversions = round(conversionValue / (470 + rnd() * 150));
  const cpa = conversions > 0 ? spend / conversions : 0;
  return { spend, conversions, conversionValue, roas, cpa };
}

export function mockShopifyTotals(start, end) {
  const rnd = rngFor('shopify', start, end);
  const days = daysBetween(start, end);
  const orders = round((28 + rnd() * 20) * days);
  const netSales = round(orders * (780 + rnd() * 260));
  const totalSales = round(netSales * (1.06 + rnd() * 0.05));
  const grossSales = round(netSales * (1.03 + rnd() * 0.06)); // a bit above net (some discounts)
  const newCustomers = round(orders * (0.4 + rnd() * 0.2));
  const returningCustomers = Math.max(0, orders - newCustomers);
  // New customers tend to have a slightly smaller first order than the
  // overall average ticket — a common, realistic pattern.
  const avgTicket = orders > 0 ? netSales / orders : 0;
  const newCustomerRevenue = round(newCustomers * avgTicket * (0.85 + rnd() * 0.2));
  const returningCustomerRevenue = Math.max(0, netSales - newCustomerRevenue);
  return {
    totalSales,
    netSales,
    grossSales,
    orders,
    newCustomers,
    returningCustomers,
    newCustomerRevenue,
    returningCustomerRevenue,
    unknownCustomerOrders: 0,
  };
}

// Meta/Google now return {month, spend, sales, orders} (spend-vs-sales bars,
// pedidos + ROAS lines). Shopify returns {month, sales, orders}.
export function mockMonthlySeries(platform, referenceDate = new Date()) {
  const months = monthsSoFar(referenceDate);
  return months.map((month, i) => {
    const rnd = rngFor(platform, 'monthly', month, i);
    if (platform === 'meta') {
      const spend = round(22000 + rnd() * 14000);
      const sales = round(spend * (2.2 + rnd() * 1.8));
      const orders = round(sales / (420 + rnd() * 160));
      return { month, spend, sales, orders };
    }
    if (platform === 'google') {
      const spend = round(18000 + rnd() * 12000);
      const sales = round(spend * (2.6 + rnd() * 2.0));
      const orders = round(sales / (440 + rnd() * 160));
      return { month, spend, sales, orders };
    }
    const sales = round(210000 + rnd() * 90000); // shopify net sales
    const orders = round(sales / (780 + rnd() * 220)); // implied from an average ticket
    return { month, sales, orders };
  });
}

export function mockTopStatesByMonth(start, end) {
  const rnd = rngFor('states', start, end);
  const states = STATES
    .map((state) => {
      const sales = round(9000 + rnd() * 60000);
      const orders = round(sales / (780 + rnd() * 260));
      const previousSales = round(sales * (0.75 + rnd() * 0.5));
      return { state, sales, orders, previousSales };
    })
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);
  return [{ start, end, states }];
}

export function mockTopProductsByMonth(start, end) {
  const rnd = rngFor('products-month', start, end);
  const products = PRODUCTS
    .map((product) => {
      const sales = round(3000 + rnd() * 38000);
      const units = round(sales / (350 + rnd() * 200));
      const previousSales = round(sales * (0.75 + rnd() * 0.5));
      return { product, sales, units, previousSales };
    })
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);
  return [{ start, end, products }];
}

export function mockFunnel(start, end, source = 'shopify') {
  const rnd = rngFor('funnel', source, start, end);
  const days = daysBetween(start, end);
  const pageViews = round((3200 + rnd() * 1400) * days);
  const addToCart = round(pageViews * (0.14 + rnd() * 0.05));
  const checkoutInfo = round(addToCart * (0.55 + rnd() * 0.1));
  const purchases = round(checkoutInfo * (0.62 + rnd() * 0.12));
  return { pageViews, addToCart, checkoutInfo, purchases };
}

export function mockGoogleFunnel(start, end) {
  const rnd = rngFor('funnel', 'google', start, end);
  const days = daysBetween(start, end);
  const clicks = round((280 + rnd() * 160) * days);
  const addToCart = round(clicks * (0.22 + rnd() * 0.08));
  const beginCheckout = round(addToCart * (0.5 + rnd() * 0.15));
  const purchases = round(beginCheckout * (0.55 + rnd() * 0.15));
  return { clicks, addToCart, beginCheckout, purchases };
}

export function mockNewCustomersMonthly(referenceDate = new Date()) {
  const months = monthsSoFar(referenceDate);
  return months.map((month, i) => {
    const rnd = rngFor('new-customers', 'monthly', month, i);
    const count = round(30 + rnd() * 45);
    const avgTicket = 700 + rnd() * 300;
    const value = round(count * avgTicket);
    return { month, count, value };
  });
}

export function mockAbandonedCheckoutsCount(start, end) {
  const rnd = rngFor('abandoned-checkouts', start, end);
  const days = daysBetween(start, end);
  return round((14 + rnd() * 10) * days);
}

const CREATIVE_CONCEPTS = [
  'BR+ Chocolate — Antes/Después [PRO]',
  'Gomitas Calcio — Testimonial [RTG]',
  'Multivitamínico — Rutina matutina [PRO]',
  'BR+ Vainilla — UGC cliente real [RTG]',
  'Kit Trío Gomitas — Oferta 20% [RTG]',
  'Proteína Keto — Comparativa [PRO]',
  'Adulto 50 — Fórmula explicada',
];

export function mockTopCreatives(start, end, limit = 5) {
  const rnd = rngFor('creatives', start, end);
  const days = daysBetween(start, end);
  const rows = CREATIVE_CONCEPTS.map((concept, i) => {
    const seed = rngFor('creative', concept, start, end);
    const spend = round((250 + seed() * 900) * days);
    const roas = 1.5 + seed() * 5.5;
    const purchaseValue = round(spend * roas);
    const cpa = 300 + seed() * 250;
    const purchases = Math.max(1, round(purchaseValue / cpa));
    const impressions = round(purchases * (400 + seed() * 500));
    const reach = round(impressions / (1.2 + seed() * 0.8));
    const frequency = reach > 0 ? impressions / reach : 0;
    const landingPageViews = round(purchases * (18 + seed() * 22));
    const uniqueCtr = 0.6 + seed() * 2.2; // percent
    return {
      adId: `mock-${i}`,
      adName: concept,
      thumbnailUrl: null, // no real creative image in mock mode
      spend,
      reach,
      impressions,
      frequency,
      uniqueCtr,
      landingPageViews,
      costPerVisit: landingPageViews > 0 ? spend / landingPageViews : null,
      purchases,
      purchaseValue,
      roas: purchaseValue / spend,
      cpa: spend / purchases,
    };
  });
  return rows.sort((a, b) => b.roas - a.roas).slice(0, limit);
}
// ---------------------------------------------------------------------
// GA4 (Tráfico Web / Engagement Web)
// ---------------------------------------------------------------------

const GA4_MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CHANNEL_NAMES = ['Direct', 'Social', 'Search', 'Email', 'Otros'];
const UTM_SAMPLE_VALUES = {
  sessionSourceMedium: ['google / organic', 'facebook / paid', 'instagram / paid', 'direct / (none)', 'newsletter / email', 'google / cpc'],
  sessionCampaignName: ['verano_2026_gomitas', 'br_plus_relanzamiento', 'hotsale_agosto', '(not set)', 'retargeting_carrito'],
  sessionSource: ['google', 'facebook', 'instagram', '(direct)', 'newsletter'],
  sessionManualAdContent: ['video_1', 'carrusel_a', 'imagen_estatica', '(not set)', 'video_2'],
};

function mock8MetricsRow(rnd) {
  const sesiones = round(200 + rnd() * 3000);
  const usuariosTotales = round(sesiones * (0.65 + rnd() * 0.2));
  const checkoutsIniciados = round(sesiones * (0.02 + rnd() * 0.03));
  const checkoutsCompletados = round(checkoutsIniciados * (0.4 + rnd() * 0.3));
  return {
    usuariosTotales,
    sesiones,
    tasaConversion: sesiones > 0 ? checkoutsCompletados / sesiones : 0,
    tasaAtc: 0.08 + rnd() * 0.08,
    tasaRebote: 0.45 + rnd() * 0.35,
    duracionMedia: round(45 + rnd() * 180),
    checkoutsIniciados,
    checkoutsCompletados,
  };
}

export function mockChannelBreakdown(start, end) {
  const rnd = rngFor('ga4-channels', start, end);
  const weights = { Direct: 0.22, Social: 0.3, Search: 0.35, Email: 0.05, Otros: 0.08 };
  const totalSessions = round((900 + rnd() * 2500) * daysBetween(start, end));
  const donut = CHANNEL_NAMES.map((name) => {
    const sessions = round(totalSessions * weights[name] * (0.85 + rnd() * 0.3));
    return { name, sessions, users: round(sessions * (0.7 + rnd() * 0.15)), pct: 0 };
  });
  const sumSessions = donut.reduce((s, d) => s + d.sessions, 0);
  donut.forEach((d) => {
    d.pct = sumSessions > 0 ? (d.sessions / sumSessions) * 100 : 0;
  });
  const sourceTable = [...donut]
    .sort((a, b) => b.sessions - a.sessions)
    .map((d) => ({ source: d.name, sessions: d.sessions, usuariosTotales: d.users, pct: d.pct }));
  return { donut, sourceTable };
}

export function mockUtmBreakdown(start, end, dimension) {
  const values = UTM_SAMPLE_VALUES[dimension] || UTM_SAMPLE_VALUES.sessionSourceMedium;
  return values
    .map((key) => {
      const rnd = rngFor('ga4-utm', dimension, key, start, end);
      return { key, ...mock8MetricsRow(rnd) };
    })
    .sort((a, b) => b.sesiones - a.sesiones);
}

export function mockEngagementKpis(start, end) {
  const rnd = rngFor('ga4-engagement', start, end);
  const row = mock8MetricsRow(rnd);
  return {
    usuariosTotales: row.usuariosTotales,
    usuariosNuevos: round(row.usuariosTotales * (0.55 + rnd() * 0.25)),
    sesiones: row.sesiones,
    tasaConversion: row.tasaConversion,
    tasaRebote: row.tasaRebote,
    tasaAtc: row.tasaAtc,
    duracionMedia: row.duracionMedia,
    checkoutsIniciados: row.checkoutsIniciados,
    checkoutsCompletados: row.checkoutsCompletados,
  };
}

// `count` lets callers ask for exactly the window they need: 12 months for
// the two capped charts (points 3/4 of the Aug 2026 change request), or a
// longer multi-year span for the detail table mock so its year filter
// (point 5) has more than one year to actually filter between.
function mockGa4MonthKeys(count) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ monthKey: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${GA4_MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear() });
  }
  return months;
}

export function mockMonthlyVisitorsSessions() {
  return mockGa4MonthKeys(12).map(({ monthKey, label }, i) => {
    const rnd = rngFor('ga4-monthly-traffic', monthKey, i);
    const sessions = round(9000 + rnd() * 6000);
    return { monthKey, month: label, sessions, visitors: round(sessions * (0.68 + rnd() * 0.15)) };
  });
}

export function mockMonthlyRates() {
  return mockGa4MonthKeys(12).map(({ monthKey, label }, i) => {
    const rnd = rngFor('ga4-monthly-rates', monthKey, i);
    return {
      monthKey,
      month: label,
      tasaConversion: 1.2 + rnd() * 2.2,
      tasaAtc: 6 + rnd() * 6,
      tasaRebote: 48 + rnd() * 30,
    };
  });
}

export function mockMonthlyDetailTable() {
  return mockGa4MonthKeys(26).map(({ monthKey, label, year }, i) => {
    const rnd = rngFor('ga4-monthly-detail', monthKey, i);
    return { key: label, monthKey, year, ...mock8MetricsRow(rnd) };
  });
}

export function mockFunnelSteps(start, end) {
  const rnd = rngFor('ga4-funnel', start, end);
  const days = daysBetween(start, end);
  const sessions = round((900 + rnd() * 2500) * days);
  const viewItem = round(sessions * (0.55 + rnd() * 0.15));
  const addToCart = round(viewItem * (0.18 + rnd() * 0.08));
  const beginCheckout = round(addToCart * (0.5 + rnd() * 0.15));
  const purchase = round(beginCheckout * (0.55 + rnd() * 0.15));

  const rawSteps = [
    { key: 'sessions', label: 'Sesión', value: sessions },
    { key: 'view_item', label: 'Vio un Producto', value: viewItem },
    { key: 'add_to_cart', label: 'Agregó al Carrito', value: addToCart },
    { key: 'begin_checkout', label: 'Inició Checkout', value: beginCheckout },
    { key: 'purchase', label: 'Compró', value: purchase },
  ];
  return rawSteps.map((step, i) => ({
    ...step,
    pctOfTotal: sessions > 0 ? (step.value / sessions) * 100 : 0,
    pctOfPrevious: i === 0 ? null : rawSteps[i - 1].value > 0 ? (step.value / rawSteps[i - 1].value) * 100 : 0,
  }));
}

export function mockSiteFunnelTopSteps(start, end) {
  const steps = mockFunnelSteps(start, end);
  const sessions = steps.find((s) => s.key === 'sessions')?.value || 0;
  const addToCart = steps.find((s) => s.key === 'add_to_cart')?.value || 0;
  return { pageViews: sessions, addToCart };
}
