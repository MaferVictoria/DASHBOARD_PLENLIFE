// Google Analytics 4 connector — real site traffic and engagement data via
// the GA4 Data API (analyticsdata.googleapis.com).
//
// Auth: service account JWT, same pattern as the (now-removed) Google
// Sheets connector — self-signed JWT exchanged for an access token, no user
// consent screen. Scope is analytics.readonly.
//
// Reads credentials from Vercel Environment Variables (names chosen to
// match what was already set up in Vercel for this project — NOT the
// GA4_CLIENT_EMAIL/GA4_PRIVATE_KEY/GA4_PROPERTY_ID names some reference
// docs use):
//   GOOGLE_ANALYTICS_CLIENT_EMAIL   → service account email
//   GOOGLE_ANALYTICS_PRIVATE_KEY    → service account private key (keep the
//                                      literal "\n" sequences — unescaped below)
//   GOOGLE_ANALYTICS_PROPERTY_ID    → GA4 Property ID (a plain number, NOT
//                                      the "G-XXXXX" Measurement ID)
//
// If credentials are missing, falls back to mock data. If credentials ARE
// present but a call fails, throws with GA4's OWN error message (never a
// generic one) — this was flagged explicitly as important for debugging,
// since GA4 dimension/metric names are easy to get subtly wrong and the
// real error message is usually the fastest way to find out which one.

import crypto from 'crypto';
import {
  mockChannelBreakdown,
  mockUtmBreakdown,
  mockEngagementKpis,
  mockMonthlyVisitorsSessions,
  mockMonthlyRates,
  mockFunnelSteps,
  mockMonthlyDetailTable,
  mockSiteFunnelTopSteps,
} from '../mockData';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// The 8 metrics shared by every UTM breakdown table AND the monthly detail
// table — one query shape reused in several places.
const METRICS_8 = ['totalUsers', 'sessions', 'bounceRate', 'averageSessionDuration', 'addToCarts', 'checkouts', 'ecommercePurchases'];

function hasCredentials() {
  return Boolean(
    process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL &&
      process.env.GOOGLE_ANALYTICS_PRIVATE_KEY &&
      process.env.GOOGLE_ANALYTICS_PROPERTY_ID
  );
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Defends against the handful of ways a private key gets mangled when
// copy-pasted from the downloaded JSON file into Vercel's env var UI:
//   - wrapping quotes accidentally included (copying the whole JSON line
//     instead of just the value between the quotes)
//   - literal "\n" two-character sequences instead of real newlines (the
//     JSON file's own escaping, meant to be un-escaped, not pasted as-is)
//   - Windows-style \r\n line endings from certain editors/clipboards
//   - stray leading/trailing whitespace
// Then validates the result actually looks like a PEM key BEFORE handing it
// to OpenSSL — so a bad key fails with a clear, specific message here
// instead of the famously unhelpful
// "error:1E08010C:DECODER routines::unsupported" deep inside crypto.sign().
function normalizePrivateKey(raw) {
  let key = (raw || '').trim();
  // Strip a leading and/or trailing quote INDEPENDENTLY — a key can pick up
  // just one stray quote (e.g. only the JSON value's closing quote) without
  // the other, so requiring both together (the original bug here) missed
  // exactly that case.
  if (key.startsWith('"')) key = key.slice(1);
  if (key.endsWith('"')) key = key.slice(0, -1);
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  if (!key) {
    throw new Error('GA4 auth: GOOGLE_ANALYTICS_PRIVATE_KEY está vacía o no configurada.');
  }
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----') || !key.endsWith('-----END PRIVATE KEY-----')) {
    // JSON.stringify() makes invisible characters visible in the error
    // message (a stray \r, a non-breaking space, a zero-width space, etc.
    // all render as an explicit escape sequence instead of disappearing) —
    // this is the actual diagnosis step, not just a length/prefix check.
    const head = JSON.stringify(key.slice(0, 30));
    const tail = JSON.stringify(key.slice(-30));
    throw new Error(
      `GA4 auth: GOOGLE_ANALYTICS_PRIVATE_KEY no tiene el formato esperado (largo: ${key.length} caracteres). ` +
        `Empieza con ${head} y termina con ${tail} — cualquier carácter invisible (espacio, \\r, comilla) ` +
        `debería verse explícito ahí entre las comillas. Vuelve a copiar el valor de "private_key" del ` +
        `archivo .json — solo lo que está ENTRE las comillas, sin incluirlas.`
    );
  }
  // A real key has multiple lines (header, body, footer). If it's all on
  // one line, the "\n" sequences never got converted to real newlines.
  if (!key.includes('\n')) {
    throw new Error(
      'GA4 auth: GOOGLE_ANALYTICS_PRIVATE_KEY llegó como una sola línea — los saltos de línea no se ' +
        'conservaron al pegarla en Vercel. Revisa que el valor tenga varias líneas reales (no solo ' +
        'literales "\\n" seguidos de texto), o vuelve a copiarla del archivo .json original.'
    );
  }
  return key;
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_ANALYTICS_PRIVATE_KEY);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`;

  let signature;
  try {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    sign.end();
    signature = sign.sign(privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    // OpenSSL's own error for a malformed PEM string is famously unhelpful
    // ("error:1E08010C:DECODER routines::unsupported", no mention of WHAT's
    // wrong) — normalizePrivateKey() already validated the shape, so if we
    // get here despite that, say so plainly instead of letting the raw
    // OpenSSL error surface on its own.
    throw new Error(
      `GA4 auth: no se pudo firmar el JWT con GOOGLE_ANALYTICS_PRIVATE_KEY (${err.message}). ` +
        `La llave tiene el formato PEM correcto (empieza y termina bien) pero OpenSSL la rechazó de ` +
        `todos modos — vuelve a copiarla desde el archivo .json original, o genera una llave nueva ` +
        `desde Google Cloud si el archivo pudo haberse corrompido.`
    );
  }
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GA4 auth: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  }
  return json.access_token;
}

// Generic report runner — mirrors the flexibility the spec asked for
// (metrics/dimensions/date range/eventNames filter), just as a function
// instead of a separately-deployed serverless endpoint, since everything
// here already runs server-side in Next.js API routes.
async function runGA4Report({ metrics, dimensions = [], since, until, eventNames, orderByMetric, limit }) {
  const accessToken = await getAccessToken();
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

  const body = {
    dateRanges: [{ startDate: since, endDate: until }],
    metrics: metrics.map((name) => ({ name })),
  };
  if (dimensions.length) body.dimensions = dimensions.map((name) => ({ name }));
  if (eventNames && eventNames.length) {
    body.dimensionFilter = { filter: { fieldName: 'eventName', inListFilter: { values: eventNames } } };
  }
  if (orderByMetric) body.orderBys = [{ metric: { metricName: orderByMetric }, desc: true }];
  if (limit) body.limit = String(limit);

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json();
  if (!res.ok) {
    // Surface GA4's real error verbatim — e.g. an unknown dimension name
    // shows up here immediately instead of a generic 400.
    throw new Error(`GA4 Data API: ${json.error?.message || `HTTP ${res.status}`}`);
  }
  return json;
}

// GA4 returns every value as a STRING (dimensionValues AND metricValues) —
// metrics need explicit Number() conversion, never compared with === raw.
function parseReport(report) {
  const dimHeaders = (report.dimensionHeaders || []).map((h) => h.name);
  const metricHeaders = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((row) => {
    const obj = {};
    dimHeaders.forEach((name, i) => {
      obj[name] = row.dimensionValues[i].value;
    });
    metricHeaders.forEach((name, i) => {
      obj[name] = Number(row.metricValues[i].value);
    });
    return obj;
  });
}

// "202608" -> "Ago 2026"
function formatYearMonth(yyyymm) {
  const year = yyyymm.slice(0, 4);
  const monthIndex = Number(yyyymm.slice(4, 6)) - 1;
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

// ---------------------------------------------------------------------
// Tráfico Web
// ---------------------------------------------------------------------

// GA4's own channel groups, bucketed into the 5 the client wants to see.
// Anything not explicitly mapped falls into "Otros" rather than being
// dropped — so the donut's total always matches the real session total.
const CHANNEL_BUCKET_MAP = {
  'Organic Search': 'Search',
  'Paid Search': 'Search',
  'Organic Shopping': 'Search',
  'Paid Shopping': 'Search',
  'Organic Social': 'Social',
  'Paid Social': 'Social',
  Email: 'Email',
  Direct: 'Direct',
};
const CHANNEL_BUCKETS = ['Direct', 'Social', 'Search', 'Email', 'Otros'];

export async function getChannelBreakdown(start, end) {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockChannelBreakdown(start, end);
  }
  const report = await runGA4Report({
    metrics: ['sessions', 'totalUsers'],
    dimensions: ['sessionDefaultChannelGroup'],
    since: start,
    until: end,
    orderByMetric: 'sessions',
  });
  const rows = parseReport(report);

  const buckets = {};
  CHANNEL_BUCKETS.forEach((b) => {
    buckets[b] = { sessions: 0, users: 0 };
  });
  rows.forEach((r) => {
    const bucket = CHANNEL_BUCKET_MAP[r.sessionDefaultChannelGroup] || 'Otros';
    buckets[bucket].sessions += r.sessions;
    buckets[bucket].users += r.totalUsers;
  });

  const totalSessions = rows.reduce((sum, r) => sum + r.sessions, 0);

  const donut = CHANNEL_BUCKETS.map((name) => ({
    name,
    sessions: buckets[name].sessions,
    users: buckets[name].users,
    pct: totalSessions > 0 ? (buckets[name].sessions / totalSessions) * 100 : 0,
  }));

  const sourceTable = rows
    .map((r) => ({
      source: r.sessionDefaultChannelGroup || '(not set)',
      sessions: r.sessions,
      users: r.totalUsers,
      pct: totalSessions > 0 ? (r.sessions / totalSessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  return { donut, sourceTable };
}

function rowsTo8Metrics(rows, keyField) {
  return rows.map((r) => ({
    key: r[keyField] || '(not set)',
    visitantes: r.totalUsers,
    sesiones: r.sessions,
    tasaConversion: r.sessions > 0 ? r.ecommercePurchases / r.sessions : 0,
    tasaAtc: r.sessions > 0 ? r.addToCarts / r.sessions : 0,
    tasaRebote: r.bounceRate, // GA4 already returns this as a 0-1 fraction
    duracionMedia: r.averageSessionDuration,
    checkoutsIniciados: r.checkouts,
    checkoutsCompletados: r.ecommercePurchases,
  }));
}

// dimension: one of sessionSourceMedium | sessionCampaignName | sessionSource | sessionManualAdContent
export async function getUtmBreakdown(start, end, dimension) {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockUtmBreakdown(start, end, dimension);
  }
  const report = await runGA4Report({
    metrics: METRICS_8,
    dimensions: [dimension],
    since: start,
    until: end,
    orderByMetric: 'sessions',
    limit: 50,
  });
  return rowsTo8Metrics(parseReport(report), dimension);
}

// ---------------------------------------------------------------------
// Engagement Web
// ---------------------------------------------------------------------

export async function getEngagementKpis(start, end) {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockEngagementKpis(start, end);
  }
  const report = await runGA4Report({ metrics: METRICS_8, since: start, until: end });
  const rows = parseReport(report);
  const r = rows[0] || {
    totalUsers: 0,
    sessions: 0,
    bounceRate: 0,
    averageSessionDuration: 0,
    addToCarts: 0,
    checkouts: 0,
    ecommercePurchases: 0,
  };
  return {
    visitantes: r.totalUsers,
    sesiones: r.sessions,
    tasaConversion: r.sessions > 0 ? r.ecommercePurchases / r.sessions : 0,
    tasaRebote: r.bounceRate,
    tasaAtc: r.sessions > 0 ? r.addToCarts / r.sessions : 0,
    duracionMedia: r.averageSessionDuration,
    checkoutsIniciados: r.checkouts,
    checkoutsCompletados: r.ecommercePurchases,
  };
}

// Deliberately NOT scoped to the selected date filter — always shows full
// available history (dimension yearMonth), per the spec. This is a genuine
// exception to how every other monthly chart in this dashboard works
// (which show "Ene → hoy" of the CURRENT year); GA4's two monthly charts
// show the full history GA4 has, since that's what was explicitly asked
// for the Visitors/Sessions chart, and applied consistently to the
// Rates chart below too (the spec didn't say either way for that one).
const GA4_HISTORY_START = '2015-01-01';

export async function getMonthlyVisitorsSessions() {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockMonthlyVisitorsSessions();
  }
  const report = await runGA4Report({
    metrics: ['sessions', 'totalUsers'],
    dimensions: ['yearMonth'],
    since: GA4_HISTORY_START,
    until: 'today',
  });
  return parseReport(report)
    .map((r) => ({ monthKey: r.yearMonth, month: formatYearMonth(r.yearMonth), sessions: r.sessions, visitors: r.totalUsers }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export async function getMonthlyRates() {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockMonthlyRates();
  }
  const report = await runGA4Report({
    metrics: ['sessions', 'ecommercePurchases', 'addToCarts', 'bounceRate'],
    dimensions: ['yearMonth'],
    since: GA4_HISTORY_START,
    until: 'today',
  });
  return parseReport(report)
    .map((r) => ({
      monthKey: r.yearMonth,
      month: formatYearMonth(r.yearMonth),
      tasaConversion: r.sessions > 0 ? (r.ecommercePurchases / r.sessions) * 100 : 0,
      tasaAtc: r.sessions > 0 ? (r.addToCarts / r.sessions) * 100 : 0,
      tasaRebote: r.bounceRate * 100,
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export async function getMonthlyDetailTable() {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockMonthlyDetailTable();
  }
  const report = await runGA4Report({
    metrics: METRICS_8,
    dimensions: ['yearMonth'],
    since: GA4_HISTORY_START,
    until: 'today',
  });
  const rows = parseReport(report).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  return rowsTo8Metrics(rows, 'yearMonth').map((row, i) => ({ ...row, key: formatYearMonth(rows[i].yearMonth) }));
}

// 5-step funnel: Sesión -> Vio un Producto -> Agregó al Carrito ->
// Inició Checkout -> Compró. Each step gets BOTH "% del total de sesiones"
// AND "% de conversión vs. el paso anterior" — the second is what actually
// tells you where people drop off, not just that they do.
export async function getFunnelSteps(start, end) {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockFunnelSteps(start, end);
  }
  const [sessionsReport, eventsReport] = await Promise.all([
    runGA4Report({ metrics: ['sessions'], since: start, until: end }),
    runGA4Report({
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      eventNames: ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'],
      since: start,
      until: end,
    }),
  ]);
  const sessions = parseReport(sessionsReport)[0]?.sessions || 0;
  const eventRows = parseReport(eventsReport);
  const countFor = (name) => eventRows.find((r) => r.eventName === name)?.eventCount || 0;

  const rawSteps = [
    { key: 'sessions', label: 'Sesión', value: sessions },
    { key: 'view_item', label: 'Vio un Producto', value: countFor('view_item') },
    { key: 'add_to_cart', label: 'Agregó al Carrito', value: countFor('add_to_cart') },
    { key: 'begin_checkout', label: 'Inició Checkout', value: countFor('begin_checkout') },
    { key: 'purchase', label: 'Compró', value: countFor('purchase') },
  ];

  return rawSteps.map((step, i) => ({
    ...step,
    pctOfTotal: sessions > 0 ? (step.value / sessions) * 100 : 0,
    pctOfPrevious: i === 0 ? null : rawSteps[i - 1].value > 0 ? (step.value / rawSteps[i - 1].value) * 100 : 0,
  }));
}

// Lighter-weight version used ONLY by Resumen Ejecutivo's "Visitas → Compras"
// funnel — just the first 2 steps (real sessions + add_to_cart), since the
// last 2 steps there (checkout/purchase) already come from Shopify's real
// checkout funnel. This replaces what used to be Meta-pixel-only visit data
// with genuine total-site traffic now that GA4 is connected.
export async function getSiteFunnelTopSteps(start, end) {
  if (!hasCredentials()) {
    console.warn('[ga4 connector] Missing credentials — using mock data.');
    return mockSiteFunnelTopSteps(start, end);
  }
  const [sessionsReport, eventsReport] = await Promise.all([
    runGA4Report({ metrics: ['sessions'], since: start, until: end }),
    runGA4Report({
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      eventNames: ['add_to_cart'],
      since: start,
      until: end,
    }),
  ]);
  const sessions = parseReport(sessionsReport)[0]?.sessions || 0;
  const addToCart = parseReport(eventsReport).find((r) => r.eventName === 'add_to_cart')?.eventCount || 0;
  return { pageViews: sessions, addToCart };
}
