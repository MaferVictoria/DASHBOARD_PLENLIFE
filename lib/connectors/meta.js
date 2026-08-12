// Meta Ads (Marketing API) connector.
//
// TODO (real integration):
//   1. Create a System User token with ads_read on the Plenlife ad account.
//   2. Call the Insights endpoint, e.g.:
//      GET https://graph.facebook.com/v20.0/act_{META_AD_ACCOUNT_ID}/insights
//        ?fields=spend,actions,action_values,purchase_roas
//        &time_range={"since":"START","until":"END"}
//        &access_token={META_ACCESS_TOKEN}
//   3. Map the response: spend -> spend, actions[action_type=purchase] -> purchases,
//      action_values[action_type=purchase] -> purchaseValue, purchase_roas -> roas.
//   4. For the monthly chart, call Insights once per month with time_increment
//      or a monthly time_range and reduce to { month, value: spend }.
//
// Until then, this returns mock data shaped exactly like the real response
// so the rest of the app never has to change when the real call is added.

import { mockMetaTotals, mockMonthlySeries } from '../mockData';

export async function getMetaTotals(start, end) {
  // return await fetchRealMetaInsights(start, end)
  return mockMetaTotals(start, end);
}

export async function getMetaMonthly() {
  // return await fetchRealMetaMonthlyInsights()
  return mockMonthlySeries('meta');
}
