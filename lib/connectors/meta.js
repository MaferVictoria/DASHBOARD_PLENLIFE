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

import { mockMetaTotals, mockMonthlySeries, mockFunnel, mockTopCreatives } from '../mockData';
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
  // instead of failing the whole chart. Pulls spend, purchase value, and
  // purchase count so the monthly chart can show gasto + ventas generadas
  // (bars) vs. pedidos (line) together.
  const results = await Promise.all(
    months.map(async ({ label, start, end }) => {
      try {
        const data = await fetchAccountInsights({
          since: start,
          until: end,
          fields: ['spend', 'actions', 'action_values'],
        });
        const spend = data ? Number(data.spend) || 0 : 0;
        const sales = extractActionValue(data?.action_values, 'purchase');
        const orders = extractActionValue(data?.actions, 'purchase');
        return { month: label, spend, sales, orders };
      } catch (err) {
        console.error(`[meta connector] Failed to fetch ${label}:`, err.message);
        return { month: label, spend: null, sales: null, orders: null }; // null = "could not load", not "zero"
      }
    })
  );

  return results;
}

// Meta's own pixel/CAPI funnel (landing_page_view → add_to_cart →
// add_payment_info → purchase) — this is Meta's ad-attributed funnel, a
// DIFFERENT thing from the site-wide funnel shown on Resumen General/Shopify
// (which comes from Shopify/GA4 and reflects all traffic, not just Meta ads).
function extractCount(list, types) {
  if (!Array.isArray(list)) return 0;
  for (const type of types) {
    const match = list.find((a) => a.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

export async function getMetaFunnel(start, end) {
  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockFunnel(start, end, 'meta');
  }

  const data = await fetchAccountInsights({ since: start, until: end, fields: ['actions'] });
  const actions = data?.actions;

  return {
    pageViews: extractCount(actions, ['landing_page_view', 'omni_landing_page_view', 'view_content']),
    addToCart: extractCount(actions, ['add_to_cart', 'omni_add_to_cart']),
    checkoutInfo: extractCount(actions, ['add_payment_info', 'omni_add_payment_info', 'initiate_checkout']),
    purchases: extractCount(actions, ['purchase', 'omni_purchase']),
  };
}

// Ranking de Creativos — ad-level (not account-level) performance, so this
// deliberately DOES pull clicks (unlike the rest of the Meta connector,
// which was scoped to conversion-only metrics per how Plenlife tracks the
// account overall). Ranked by ROAS; ads with no spend in the period are
// dropped since a ROAS on $0 spend isn't a meaningful ranking signal.
async function fetchAdLevelInsights(start, end) {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const token = process.env.META_ACCESS_TOKEN;

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set('level', 'ad');
  url.searchParams.set(
    'fields',
    'ad_id,ad_name,spend,reach,impressions,frequency,unique_ctr,actions,action_values'
  );
  url.searchParams.set('time_range', JSON.stringify({ since: start, until: end }));
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const json = await res.json();

  if (!res.ok || json.error) {
    const message = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta Insights API (ad-level): ${message}`);
  }

  return json.data || [];
}

// Thumbnails aren't part of Insights — need a separate call per ad against
// the AdCreative object. Only fetched for the ads that actually make the
// final ranking (at most `limit`), not the whole account, to keep this cheap.
async function fetchCreativeThumbnail(adId) {
  const token = process.env.META_ACCESS_TOKEN;
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${adId}`);
  url.searchParams.set('fields', 'creative{thumbnail_url}');
  url.searchParams.set('access_token', token);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    if (!res.ok || json.error) return null;
    return json.creative?.thumbnail_url || null;
  } catch (err) {
    console.error(`[meta connector] thumbnail fetch failed for ${adId}:`, err.message);
    return null; // missing thumbnail shouldn't break the whole ranking
  }
}

export async function getMetaTopCreatives(start, end, limit = 5) {
  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockTopCreatives(start, end, limit);
  }

  const rows = await fetchAdLevelInsights(start, end);

  const ranked = rows
    .map((row) => {
      const spend = Number(row.spend) || 0;
      const reach = Number(row.reach) || 0;
      const impressions = Number(row.impressions) || 0;
      const frequency = Number(row.frequency) || 0;
      // Meta reports unique_ctr as a percentage already (e.g. "2.31"), not a fraction.
      const uniqueCtr = Number(row.unique_ctr) || 0;
      const landingPageViews = extractActionValue(row.actions, 'landing_page_view');
      const purchases = extractActionValue(row.actions, 'purchase');
      const purchaseValue = extractActionValue(row.action_values, 'purchase');
      return {
        adId: row.ad_id,
        adName: row.ad_name || '(sin nombre)',
        spend,
        reach,
        impressions,
        frequency,
        uniqueCtr,
        landingPageViews,
        costPerVisit: landingPageViews > 0 ? spend / landingPageViews : null,
        purchases,
        purchaseValue,
        roas: spend > 0 ? purchaseValue / spend : 0,
        cpa: purchases > 0 ? spend / purchases : 0,
      };
    })
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, limit);

  const withThumbnails = await Promise.all(
    ranked.map(async (r) => ({ ...r, thumbnailUrl: await fetchCreativeThumbnail(r.adId) }))
  );

  return withThumbnails;
}
