// Shopify (Admin API) connector.
//
// IMPORTANT: "Top ciudades por mes" and "Top productos por mes" in the
// dashboard are 100% Shopify-sourced — NOT Meta/Google. Meta and Google
// don't have real geography/product-level sales data for Plenlife (we
// deliberately scoped them to conversion-only metrics), so this file is the
// only place that ever needs to answer those two questions.
//
// TODO (real integration):
//   1. Create a custom app in Shopify Admin with read_orders, read_products,
//      read_customers scopes; store the Admin API access token as
//      SHOPIFY_ADMIN_API_TOKEN.
//   2. Pull orders via the Orders REST endpoint or, preferably, the
//      Analytics/Reports API (or ShopifyQL) for totals:
//      GET https://{SHOPIFY_STORE_DOMAIN}/admin/api/{SHOPIFY_API_VERSION}/orders.json
//        ?status=any&created_at_min=START&created_at_max=END
//   3. totalSales / netSales come from order line items minus refunds/discounts
//      (or directly from the Shopify "Total sales" report via ShopifyQL).
//   4. newCustomers vs returningCustomers: compare customer.orders_count on
//      each order's customer object (1 => new, >1 => returning) within range.
//   5. topCitiesByMonth: group orders by month, aggregate
//      order.shipping_address.city (or order.customer.default_address.city)
//      within each month, sum line-item totals per city, sort descending.
//   6. topProductsByMonth: group orders by month, aggregate order.line_items
//      by product title (or product_id, then resolve the title), sum
//      quantity × price, sort descending.
//   7. funnel (pageViews/addToCart/checkoutInfo/purchases): this data lives in
//      Shopify's own Analytics (or GA4 if that's what's wired to the storefront),
//      not the Admin Orders API — pull it from whichever is the source of truth
//      your existing dashboard already uses.
//
// Until then, this returns mock data shaped exactly like the real response.

import {
  mockShopifyTotals,
  mockMonthlySeries,
  mockTopCitiesByMonth,
  mockTopProductsByMonth,
  mockFunnel,
} from '../mockData';

export async function getShopifyTotals(start, end) {
  // return await fetchRealShopifyTotals(start, end)
  return mockShopifyTotals(start, end);
}

export async function getShopifyMonthly() {
  // return await fetchRealShopifyMonthlyNetSales()
  return mockMonthlySeries('shopify');
}

// Real version: aggregate Shopify order line items by shipping city, grouped
// by month. Do NOT pull city data from Meta or Google — they don't have it.
export async function getShopifyTopCitiesByMonth() {
  // return await fetchRealShopifyTopCitiesByMonth()
  return mockTopCitiesByMonth();
}

// Real version: aggregate Shopify order line items by product title, grouped
// by month. Do NOT pull product data from Meta or Google — they don't have it.
export async function getShopifyTopProductsByMonth() {
  // return await fetchRealShopifyTopProductsByMonth()
  return mockTopProductsByMonth();
}

export async function getShopifyFunnel(start, end) {
  // return await fetchRealFunnel(start, end) — from Shopify Analytics or GA4
  return mockFunnel(start, end);
}
