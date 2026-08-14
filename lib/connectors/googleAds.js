// Google Ads API connector — REAL implementation (Performance Max only).
//
// Reads credentials from Vercel Environment Variables:
//   GOOGLE_ADS_DEVELOPER_TOKEN
//   GOOGLE_ADS_CLIENT_ID
//   GOOGLE_ADS_CLIENT_SECRET
//   GOOGLE_ADS_REFRESH_TOKEN
//   GOOGLE_ADS_CUSTOMER_ID       → the Plenlife ad account (dashes are stripped automatically)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID → the manager/MCC account (optional, but needed if you
//                                   access Plenlife's account through an MCC — dashes stripped too)
//   GOOGLE_ADS_API_VERSION       → optional, defaults to v25 (current as of Aug 2026)
//
// Scoped to Performance Max only, per how Plenlife's team uses Google Ads —
// every query below filters campaign.advertising_channel_type = 'PERFORMANCE_MAX'.
//
// If credentials are missing, falls back to mock data (so `npm run dev` works
// locally without secrets). If credentials ARE present but a call fails, it
// throws — same "visible error over silent fake numbers" pattern used by the
// Meta and Shopify connectors.
//
// Note on rate limits: Explorer Access (Google's no-application-needed tier)
// allows 2,880 operations/day against production accounts — this dashboard
// makes a handful of calls per page load, so that should be comfortably
// enough. If you ever see RESOURCE_EXHAUSTED errors, that's the signal you've
// outgrown Explorer Access and need to apply for Basic Access.

import { mockGoogleTotals, mockMonthlySeries } from '../mockData';
import { monthsSoFar, toISODate } from '../dateRanges';

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function hasCredentials() {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

function round(n) {
  return Math.round(n);
}

// Accepts IDs copied straight from the Google Ads UI (which shows them as
// "123-456-7890") — the API needs them with no dashes.
function cleanCustomerId(id) {
  return id ? id.replace(/-/g, '') : id;
}

// --- OAuth access token, cached in module scope for the lifetime of a warm
// serverless instance so we're not exchanging the refresh token on every
// single call. ---
let _accessToken = null;
let _accessTokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (_accessToken && now < _accessTokenExpiresAt - 60000) {
    return _accessToken;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Google OAuth: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  }

  _accessToken = json.access_token;
  _accessTokenExpiresAt = now + json.expires_in * 1000;
  return _accessToken;
}

// Runs a GAQL query against the Plenlife customer account. Handles
// pagination defensively, though a handful of PMax campaigns rarely needs it.
async function runGAQL(query) {
  const accessToken = await getAccessToken();
  const customerId = cleanCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const loginCustomerId = cleanCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`;

  let results = [];
  let pageToken;

  do {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
      },
      body: JSON.stringify({ query, pageToken, pageSize: 1000 }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();

    if (!res.ok) {
      const message = json?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Google Ads API: ${message}`);
    }

    results = results.concat(json.results || []);
    pageToken = json.nextPageToken;
  } while (pageToken);

  return results;
}

export async function getGoogleTotals(start, end) {
  if (!hasCredentials()) {
    console.warn('[google ads connector] Missing Google Ads credentials — using mock data.');
    return mockGoogleTotals(start, end);
  }

  const query = `
    SELECT metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
      AND segments.date BETWEEN '${start}' AND '${end}'
  `;
  const rows = await runGAQL(query);

  let costMicros = 0;
  let conversions = 0;
  let conversionValue = 0;
  rows.forEach((row) => {
    costMicros += Number(row.metrics?.costMicros || 0);
    conversions += Number(row.metrics?.conversions || 0);
    conversionValue += Number(row.metrics?.conversionsValue || 0);
  });

  const spend = round(costMicros / 1_000_000);
  const roas = spend > 0 ? conversionValue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;

  return {
    spend,
    conversions: round(conversions),
    conversionValue: round(conversionValue),
    roas,
    cpa,
  };
}

export async function getGoogleMonthly() {
  if (!hasCredentials()) {
    console.warn('[google ads connector] Missing Google Ads credentials — using mock data.');
    return mockMonthlySeries('google');
  }

  const now = new Date();
  const months = monthsSoFar(now);
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayISO = toISODate(now);

  const query = `
    SELECT segments.month, metrics.cost_micros
    FROM campaign
    WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
      AND segments.date BETWEEN '${yearStart}' AND '${todayISO}'
  `;

  let rows;
  try {
    rows = await runGAQL(query);
  } catch (err) {
    console.error('[google ads connector] monthly aggregation failed:', err.message);
    // Same "gap, not zero" convention as the Meta and Shopify monthly charts.
    return months.map((m) => ({ month: m, value: null }));
  }

  const byMonth = {};
  rows.forEach((row) => {
    // segments.month comes back as "YYYY-MM-01".
    const monthIndex = new Date(row.segments.month).getMonth();
    const label = MONTH_LABELS[monthIndex];
    byMonth[label] = (byMonth[label] || 0) + Number(row.metrics?.costMicros || 0);
  });

  return months.map((month) => ({ month, value: round((byMonth[month] || 0) / 1_000_000) }));
}
