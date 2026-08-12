// Meta Ads (Marketing API) connector — REAL implementation.
//
// Reads credentials from Vercel Environment Variables:
//   META_ACCESS_TOKEN   → System User or long-lived access token with ads_read
//   META_AD_ACCOUNT_ID  → numeric ad account id, WITHOUT the "act_" prefix
//   META_API_VERSION    → optional, defaults to v26.0 (current as of Aug 2026)
//
// If the credentials are missing (e.g. running locally without .env.local),
// this falls back to mock data so `npm run dev` still works out of the box.
// If the credentials ARE present but the call to Meta fails (bad token,
// rate limit, wrong account id, etc.), it throws — the API route below
// surfaces that as a visible error instead of silently showing fake numbers.

import { mockMetaTotals, mockMonthlySeries } from '../mockData';
import { toISODate } from '../dateRanges';

const API_VERSION = process.env.META_API_VERSION || 'v26.0';
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function hasCredentials() {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

async function fetchAccountInsights({ since, until, fields }) {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const token = process.env.META_ACCESS_TOKEN;

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set('level', 'account');
  url.searchParams.set('fields', fields.join(','));
  url.searchParams.set('time_range', JSON.stringify({ since, until }));
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString(), {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();

  if (!res.ok || json.error) {
    const message = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta Insights API: ${message}`);
  }

  // No spend in the period returns an empty data array — that's valid, not an error.
  return json.data?.[0] || null;
}

// "purchase" is the canonical action type; Meta also returns several
// duplicate variants (omni_purchase, onsite_web_purchase,
// offsite_conversion.fb_pixel_purchase, etc.) that carry the SAME value —
// summing them would double count, so we take the first match only,
// preferring the canonical "purchase" type.
function extractActionValue(list, type = 'purchase') {
  if (!Array.isArray(list)) return 0;
  const exact = list.find((a) => a.action_type === type);
  if (exact) return Number(exact.value) || 0;
  const fallback = list.find((a) => a.action_type === 'omni_purchase');
  return fallback ? Number(fallback.value) || 0 : 0;
}

export async function getMetaTotals(start, end) {
  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockMetaTotals(start, end);
  }

  const data = await fetchAccountInsights({
    since: start,
    until: end,
    fields: ['spend', 'actions', 'action_values'],
  });

  const spend = data ? Number(data.spend) || 0 : 0;
  const purchases = extractActionValue(data?.actions, 'purchase');
  const purchaseValue = extractActionValue(data?.action_values, 'purchase');
  const roas = spend > 0 ? purchaseValue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : 0;

  return { spend, purchases, purchaseValue, roas, cpa };
}

export async function getMetaMonthly() {
  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockMonthlySeries('meta');
  }

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const year = now.getFullYear();

  const months = [];
  for (let m = 0; m <= currentMonthIndex; m++) {
    const start = new Date(year, m, 1);
    const end = m === currentMonthIndex ? now : new Date(year, m + 1, 0);
    months.push({ label: MONTH_LABELS[m], start: toISODate(start), end: toISODate(end) });
  }

  // One Insights call per month (Meta doesn't bucket by calendar month
  // natively) — fine at this volume, and failures are isolated per month
  // instead of failing the whole chart.
  const results = await Promise.all(
    months.map(async ({ label, start, end }) => {
      try {
        const data = await fetchAccountInsights({ since: start, until: end, fields: ['spend'] });
        return { month: label, value: data ? Number(data.spend) || 0 : 0 };
      } catch (err) {
        console.error(`[meta connector] Failed to fetch ${label}:`, err.message);
        return { month: label, value: null }; // null = "could not load", not "zero spend"
      }
    })
  );

  return results;
}
