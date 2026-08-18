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

const CITIES = [
  'Monterrey', 'Ciudad de México', 'Guadalajara', 'Puebla', 'Querétaro',
  'Tijuana', 'Mérida', 'León', 'Toluca', 'San Luis Potosí',
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
  const newCustomers = round(orders * (0.4 + rnd() * 0.2));
  const returningCustomers = Math.max(0, orders - newCustomers);
  // New customers tend to have a slightly smaller first order than the
  // overall average ticket — a common, realistic pattern.
  const avgTicket = orders > 0 ? netSales / orders : 0;
  const newCustomerRevenue = round(newCustomers * avgTicket * (0.85 + rnd() * 0.2));
  return {
    totalSales,
    netSales,
    orders,
    newCustomers,
    returningCustomers,
    newCustomerRevenue,
    unknownCustomerOrders: 0,
  };
}

// Meta/Google now return {month, spend, sales} pairs (for the spend-vs-sales
// combo charts). Shopify keeps the simpler {month, value} shape (net sales) —
// its monthly chart is still a single series.
export function mockMonthlySeries(platform, referenceDate = new Date()) {
  const months = monthsSoFar(referenceDate);
  return months.map((month, i) => {
    const rnd = rngFor(platform, 'monthly', month, i);
    if (platform === 'meta') {
      const spend = round(22000 + rnd() * 14000);
      const sales = round(spend * (2.2 + rnd() * 1.8));
      return { month, spend, sales };
    }
    if (platform === 'google') {
      const spend = round(18000 + rnd() * 12000);
      const sales = round(spend * (2.6 + rnd() * 2.0));
      return { month, spend, sales };
    }
    const value = round(210000 + rnd() * 90000); // shopify net sales
    return { month, value };
  });
}

export function mockTopCitiesByMonth(referenceDate = new Date()) {
  const months = monthsSoFar(referenceDate).slice(-2); // current + previous month
  return months.map((month) => {
    const rnd = rngFor('cities', month);
    const cities = CITIES
      .map((city) => ({ city, sales: round(9000 + rnd() * 60000) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    return { month, cities };
  });
}

export function mockTopProductsByMonth(referenceDate = new Date()) {
  const months = monthsSoFar(referenceDate).slice(-2);
  return months.map((month) => {
    const rnd = rngFor('products-month', month);
    const products = PRODUCTS
      .map((product) => ({ product, sales: round(3000 + rnd() * 38000) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    return { month, products };
  });
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