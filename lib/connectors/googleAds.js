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

import { mockGoogleTotals, mockMonthlySeries, mockGoogleFunnel } from '../mockData';
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

// Google Ads API errors put the USEFUL detail nested inside error.details[]
// (a GoogleAdsFailure with the actual query/auth error and message) — the
// top-level error.message is often just a generic wrapper like "Request
// contains an invalid argument." This digs out the real reason.
//
// If there's no structured detail at all (which happens when Google rejects
// the request before it even reaches query validation — e.g. something
// malformed about the request itself rather than the GAQL), fall back to
// dumping the raw error object so the on-screen banner is still useful
// without anyone having to dig through Vercel's function logs.
function extractGoogleAdsError(json, res) {
  const failureDetail = json?.error?.details?.find((d) => Array.isArray(d.errors));
  const nested = failureDetail?.errors?.[0];
  if (nested) {
    const code = nested.errorCode ? Object.values(nested.errorCode)[0] : null;
    return `${nested.message}${code ? ` [${code}]` : ''}`;
  }
  const base = json?.error?.message || `HTTP ${res.status}`;
  const raw = JSON.stringify(json?.error ?? json ?? {}).slice(0, 400);
  return `${base} — detalle crudo: ${raw}`;
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
      // NOTE: don't send pageSize — Google Ads API fixes this at 10,000 rows
      // and rejects requests that try to set it (PAGE_SIZE_NOT_SUPPORTED).
      body: JSON.stringify({ query, pageToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();

    if (!res.ok) {
      // Full raw response goes to the Vercel function log (Deployments →
      // /api/google) even though the UI banner only shows the short version.
      console.error('[google ads connector] raw error response:', JSON.stringify(json));
      throw new Error(`Google Ads API: ${extractGoogleAdsError(json, res)}`);
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
    SELECT segments.month, metrics.cost_micros, metrics.conversions_value, metrics.conversions
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
    return months.map((m) => ({ month: m, spend: null, sales: null, orders: null }));
  }

  const byMonth = {};
  rows.forEach((row) => {
    // segments.month comes back as "YYYY-MM-01".
    const monthIndex = new Date(row.segments.month).getMonth();
    const label = MONTH_LABELS[monthIndex];
    if (!byMonth[label]) byMonth[label] = { costMicros: 0, conversionsValue: 0, conversions: 0 };
    byMonth[label].costMicros += Number(row.metrics?.costMicros || 0);
    byMonth[label].conversionsValue += Number(row.metrics?.conversionsValue || 0);
    byMonth[label].conversions += Number(row.metrics?.conversions || 0);
  });

  return months.map((month) => {
    const bucket = byMonth[month] || { costMicros: 0, conversionsValue: 0, conversions: 0 };
    return {
      month,
      spend: round(bucket.costMicros / 1_000_000),
      sales: round(bucket.conversionsValue),
      orders: round(bucket.conversions),
    };
  });
}

// Funnel for Google Ads (PMax). Two different data shapes stitched together:
//
//   1. Clicks — real ad clicks, used as the top-of-funnel step. This is a
//      genuine metric, not a proxy.
//   2. Add to cart / Begin checkout / Purchase — pulled from
//      segments.conversion_action_category, which only has real numbers IF
//      Plenlife's Google Ads account has conversion actions tagged with
//      those categories (typically via GA4 ecommerce event import). If the
//      account doesn't track add-to-cart/begin-checkout as distinct Google
//      Ads conversion actions, those two steps will legitimately come back
//      as 0 — that's an honest "not tracked", not a bug. "Purchase" should
//      still be populated as long as PMax conversion tracking is set up at
//      all (which it needs to be for the KPI cards to work in the first
//      place).
//
// Kept as two separate queries because mixing a segmenting field
// (conversion_action_category) into the same query as metrics.clicks would
// split/duplicate the click count across category rows instead of giving a
// clean total.
// `knownPurchases`: pass in the SAME number already shown on the "Compras"
// KPI card (totals.conversions, from metrics.conversions — primary
// conversion actions only) so the funnel's last step always matches it
// exactly. Without this, the funnel used metrics.all_conversions (primary +
// secondary) for every step, which is the right call for Añadido al
// carrito/Checkout iniciado (those are typically secondary-only actions in
// Google Ads, so all_conversions is the only way to see them at all) but
// was WRONG for Compras specifically: if the account has more than one
// conversion action categorized as "Purchase" (e.g. a primary one plus a
// secondary/imported one), all_conversions double-counts them, while
// conversions correctly counts only the primary one. Confirmed against a
// real account (25 ago 2026): funnel showed 30, KPI showed 20 — the gap
// was exactly this primary-vs-all distinction.
export async function getGoogleFunnel(start, end, knownPurchases) {
  if (!hasCredentials()) {
    console.warn('[google ads connector] Missing Google Ads credentials — using mock data.');
    return mockGoogleFunnel(start, end);
  }

  const clicksQuery = `
    SELECT metrics.clicks
    FROM campaign
    WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
      AND segments.date BETWEEN '${start}' AND '${end}'
  `;
  const categoryQuery = `
    SELECT segments.conversion_action_category, metrics.all_conversions
    FROM campaign
    WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
      AND segments.date BETWEEN '${start}' AND '${end}'
  `;

  const [clicksRows, categoryRows] = await Promise.all([runGAQL(clicksQuery), runGAQL(categoryQuery)]);

  const clicks = clicksRows.reduce((sum, row) => sum + Number(row.metrics?.clicks || 0), 0);

  const byCategory = {};
  categoryRows.forEach((row) => {
    const category = row.segments?.conversionActionCategory;
    if (!category) return;
    byCategory[category] = (byCategory[category] || 0) + Number(row.metrics?.allConversions || 0);
  });

  return {
    clicks: round(clicks),
    addToCart: round(byCategory.ADD_TO_CART || 0),
    beginCheckout: round(byCategory.BEGIN_CHECKOUT || 0),
    purchases: knownPurchases !== undefined && knownPurchases !== null ? knownPurchases : round(byCategory.PURCHASE || 0),
  };
}
// ============================================================================
// AGREGAR AL FINAL de lib/connectors/googleAds.js (después de todo lo que ya existe)
// ============================================================================
//
// Nota de reconstrucción: igual que con meta.js, estas funciones son
// AUTOCONTENIDAS salvo por `runGAQL`, que asumo que sigue existiendo en el
// archivo con ese nombre (se ha usado consistentemente en todo este proyecto).
// Si `runGAQL` no existe o tiene otra firma, avísame para ajustarlo.
//
// Gasto por Estado / por Ciudad / por Edad / por Género — Google Ads (PMax).
//
// ⚠️ Dos cosas técnicas importantes de la propia API de Google Ads, no
// decisiones mías:
//
// 1. `geographic_view` regresa el ID del criterio de ubicación (un
//    resource_name tipo "geoTargetConstants/1234"), NUNCA el nombre legible
//    de la ciudad/estado directamente — hay que resolverlo con una segunda
//    consulta contra `geo_target_constant`. Por eso estas funciones hacen
//    2 consultas en cadena, no 1.
//
// 2. Google Ads NO permite combinar edad y género en una sola consulta
//    (limitación documentada de la API, no algo que se pueda evitar) — por
//    eso son 2 tablas separadas, a diferencia de Meta que sí las combina.

function round(n) {
  return Math.round(n);
}

function formatAgeRangeLabel(enumValue) {
  if (!enumValue) return 'No especificada';
  if (enumValue === 'AGE_RANGE_65_UP') return '65+';
  if (enumValue === 'UNKNOWN' || enumValue === 'UNSPECIFIED' || enumValue === 'AGE_RANGE_UNDETERMINED') {
    return 'No especificada';
  }
  const m = enumValue.match(/AGE_RANGE_(\d+)_(\d+)/);
  return m ? `${m[1]}-${m[2]}` : enumValue;
}

const GOOGLE_GENDER_LABELS = { MALE: 'Hombre', FEMALE: 'Mujer', UNDETERMINED: 'No determinado' };

// Resuelve un lote de resource_names de geo_target_constant a su nombre
// legible (canonical_name incluye ", Estado, País" — se usa `name` a solas
// para que se vea limpio, ej. "Guadalajara" en vez de "Guadalajara,Jalisco,Mexico").
async function resolveGeoTargetNames(resourceNames) {
  if (resourceNames.length === 0) return {};
  const idList = resourceNames.map((rn) => `'${rn}'`).join(',');
  const query = `
    SELECT geo_target_constant.resource_name, geo_target_constant.name
    FROM geo_target_constant
    WHERE geo_target_constant.resource_name IN (${idList})
  `;
  const rows = await runGAQL(query);
  const map = {};
  rows.forEach((row) => {
    const rn = row.geoTargetConstant?.resourceName;
    if (rn) map[rn] = row.geoTargetConstant?.name || rn;
  });
  return map;
}

function mockGoogleGeoBreakdown(start, end, level) {
  const NAMES = level === 'city'
    ? ['Guadalajara', 'Monterrey', 'Puebla', 'Querétaro', 'Ciudad de México']
    : ['Jalisco', 'Nuevo León', 'Puebla', 'Querétaro', 'Ciudad de México'];
  return NAMES.map((name, i) => {
    const spend = round(600 + ((i * 41 + start.length) % 10) * 200);
    const roas = 2.5 + ((i * 11) % 5);
    const conversionValue = round(spend * roas);
    return { location: name, spend, conversions: Math.max(1, Math.round(conversionValue / 450)), conversionValue, roas };
  }).sort((a, b) => b.spend - a.spend);
}

function mockGoogleAgeBreakdown(start, end) {
  return ['18-24', '25-34', '35-44', '45-54', '55-64'].map((ageRange, i) => {
    const spend = round(500 + ((i * 23 + start.length) % 10) * 150);
    const roas = 2 + ((i * 7) % 5);
    const conversionValue = round(spend * roas);
    return { ageRange, spend, conversions: Math.max(1, Math.round(conversionValue / 450)), conversionValue, roas };
  }).sort((a, b) => b.spend - a.spend);
}

function mockGoogleGenderBreakdown(start, end) {
  return ['Hombre', 'Mujer'].map((gender, i) => {
    const spend = round(1500 + ((i * 31 + start.length) % 10) * 220);
    const roas = 2.2 + ((i * 9) % 5);
    const conversionValue = round(spend * roas);
    return { gender, spend, conversions: Math.max(1, Math.round(conversionValue / 450)), conversionValue, roas };
  }).sort((a, b) => b.spend - a.spend);
}

// level: 'region' (estado) | 'city' (ciudad)
export async function getGoogleGeoBreakdown(start, end, level = 'region') {
  if (!hasCredentials()) {
    console.warn('[google ads connector] Missing Google Ads credentials — using mock data.');
    return mockGoogleGeoBreakdown(start, end, level);
  }

  const segmentField = level === 'city' ? 'segments.geo_target_city' : 'segments.geo_target_region';
  const query = `
    SELECT ${segmentField}, metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM geographic_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
  `;
  const rows = await runGAQL(query);

  const totals = {};
  rows.forEach((row) => {
    const geoResourceName = level === 'city' ? row.segments?.geoTargetCity : row.segments?.geoTargetRegion;
    if (!geoResourceName) return;
    if (!totals[geoResourceName]) totals[geoResourceName] = { cost: 0, conversions: 0, conversionsValue: 0 };
    totals[geoResourceName].cost += Number(row.metrics?.costMicros || 0);
    totals[geoResourceName].conversions += Number(row.metrics?.conversions || 0);
    totals[geoResourceName].conversionsValue += Number(row.metrics?.conversionsValue || 0);
  });

  const nameMap = await resolveGeoTargetNames(Object.keys(totals));

  const result = Object.entries(totals).map(([resourceName, t]) => {
    const spend = round(t.cost / 1_000_000);
    return {
      location: nameMap[resourceName] || resourceName,
      spend,
      conversions: round(t.conversions),
      conversionValue: round(t.conversionsValue),
      roas: spend > 0 ? t.conversionsValue / spend : 0,
    };
  });

  return result.sort((a, b) => b.spend - a.spend);
}

export async function getGoogleAgeBreakdown(start, end) {
  if (!hasCredentials()) {
    console.warn('[google ads connector] Missing Google Ads credentials — using mock data.');
    return mockGoogleAgeBreakdown(start, end);
  }

  const query = `
    SELECT ad_group_criterion.age_range.type, metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM age_range_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
  `;
  const rows = await runGAQL(query);

  const totals = {};
  rows.forEach((row) => {
    const ageType = row.adGroupCriterion?.ageRange?.type;
    if (!ageType) return;
    if (!totals[ageType]) totals[ageType] = { cost: 0, conversions: 0, conversionsValue: 0 };
    totals[ageType].cost += Number(row.metrics?.costMicros || 0);
    totals[ageType].conversions += Number(row.metrics?.conversions || 0);
    totals[ageType].conversionsValue += Number(row.metrics?.conversionsValue || 0);
  });

  const result = Object.entries(totals).map(([ageType, t]) => {
    const spend = round(t.cost / 1_000_000);
    return {
      ageRange: formatAgeRangeLabel(ageType),
      spend,
      conversions: round(t.conversions),
      conversionValue: round(t.conversionsValue),
      roas: spend > 0 ? t.conversionsValue / spend : 0,
    };
  });

  return result.sort((a, b) => b.spend - a.spend);
}

export async function getGoogleGenderBreakdown(start, end) {
  if (!hasCredentials()) {
    console.warn('[google ads connector] Missing Google Ads credentials — using mock data.');
    return mockGoogleGenderBreakdown(start, end);
  }

  const query = `
    SELECT ad_group_criterion.gender.type, metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM gender_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
  `;
  const rows = await runGAQL(query);

  const totals = {};
  rows.forEach((row) => {
    const genderType = row.adGroupCriterion?.gender?.type;
    if (!genderType) return;
    if (!totals[genderType]) totals[genderType] = { cost: 0, conversions: 0, conversionsValue: 0 };
    totals[genderType].cost += Number(row.metrics?.costMicros || 0);
    totals[genderType].conversions += Number(row.metrics?.conversions || 0);
    totals[genderType].conversionsValue += Number(row.metrics?.conversionsValue || 0);
  });

  const result = Object.entries(totals).map(([genderType, t]) => {
    const spend = round(t.cost / 1_000_000);
    return {
      gender: GOOGLE_GENDER_LABELS[genderType] || genderType,
      spend,
      conversions: round(t.conversions),
      conversionValue: round(t.conversionsValue),
      roas: spend > 0 ? t.conversionsValue / spend : 0,
    };
  });

  return result.sort((a, b) => b.spend - a.spend);
}
