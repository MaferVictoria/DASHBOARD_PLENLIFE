// Google Ads connector (Performance Max only).
//
// TODO (real integration):
//   1. Set up OAuth (client id/secret + refresh token) and a developer token.
//   2. Use Google Ads API (google-ads-api npm package, or GAQL over REST) with a query like:
//      SELECT campaign.name, metrics.cost_micros, metrics.conversions,
//             metrics.conversions_value
//      FROM campaign
//      WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
//        AND segments.date BETWEEN 'START' AND 'END'
//   3. cost_micros / 1,000,000 -> spend. metrics.conversions -> conversions.
//      metrics.conversions_value -> conversionValue. roas = conversionValue / spend.
//   4. For the monthly chart, group the same query by segments.month.
//
// Until then, this returns mock data shaped exactly like the real response.

import { mockGoogleTotals, mockMonthlySeries } from '../mockData';

export async function getGoogleTotals(start, end) {
  // return await fetchRealGoogleAdsReport(start, end)
  return mockGoogleTotals(start, end);
}

export async function getGoogleMonthly() {
  // return await fetchRealGoogleAdsMonthlyReport()
  return mockMonthlySeries('google');
}
