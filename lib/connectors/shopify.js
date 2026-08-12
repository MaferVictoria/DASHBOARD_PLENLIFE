// Shopify (Admin API) connector.
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
//   5. salesByProduct: aggregate line_items across orders by product title.
//   6. topCitiesByMonth: aggregate order.shipping_address.city by month.
//   7. funnel (pageViews/addToCart/checkoutInfo/purchases): this data lives in
//      Shopify's own Analytics (or GA4 if that's what's wired to the storefront),
//      not the Admin Orders API — pull it from whichever is the source of truth
//      your existing dashboard already uses.
//
// Until then, this returns mock data shaped exactly like the real response.

import {
  mockShopifyTotals,
  mockMonthlySeries,
  mockSalesByProduct,
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

export async function getShopifySalesByProduct(start, end) {
  // return await fetchRealShopifySalesByProduct(start, end)
  return mockSalesByProduct(start, end);
}

export async function getShopifyTopCitiesByMonth() {
  // return await fetchRealShopifyTopCitiesByMonth()
  return mockTopCitiesByMonth();
}

export async function getShopifyTopProductsByMonth() {
  // return await fetchRealShopifyTopProductsByMonth()
  return mockTopProductsByMonth();
}

export async function getShopifyFunnel(start, end) {
  // return await fetchRealFunnel(start, end) — from Shopify Analytics or GA4
  return mockFunnel(start, end);
}
