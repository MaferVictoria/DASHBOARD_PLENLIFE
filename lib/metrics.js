// Blended / cross-channel calculations.
// Deliberately NOT attribution — this compares total ad spend against
// Shopify's own reported totals, per how Plenlife's team already works.

export function computeBlended(metaTotals, googleTotals, shopifyTotals) {
  const totalSpend = (metaTotals?.spend || 0) + (googleTotals?.spend || 0);
  const netSales = shopifyTotals?.netSales || 0;
  const totalSales = shopifyTotals?.totalSales || 0;
  const newCustomers = shopifyTotals?.newCustomers || 0;

  const mer = totalSpend > 0 ? totalSales / totalSpend : 0;
  const blendedRoas = totalSpend > 0 ? netSales / totalSpend : 0;
  const blendedCac = newCustomers > 0 ? totalSpend / newCustomers : 0;

  return { totalSpend, mer, blendedRoas, blendedCac };
}
