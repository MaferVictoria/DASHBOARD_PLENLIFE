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
//
// ⚠️ The omni_purchase fallback is purchase-specific. Do NOT use this
// function for other action types (landing_page_view, add_to_cart, ...):
// if the requested type is missing it would return the PURCHASE count
// instead of 0. Use extractCount() below for everything that isn't a purchase.
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

// First-match count/value extractor for any action type, trying each of the
// given types in order (canonical first, then omni_ variants). Unlike
// extractActionValue() it never falls back to purchases.
function extractCount(list, types) {
  if (!Array.isArray(list)) return 0;
  for (const type of types) {
    const match = list.find((a) => a.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

const LANDING_VIEW_TYPES = ['landing_page_view', 'omni_landing_page_view'];
const ADD_TO_CART_TYPES = ['add_to_cart', 'omni_add_to_cart'];
const INITIATE_CHECKOUT_TYPES = ['initiate_checkout', 'omni_initiate_checkout'];

// Meta's own pixel/CAPI funnel (landing_page_view → add_to_cart →
// add_payment_info → purchase) — this is Meta's ad-attributed funnel, a
// DIFFERENT thing from the site-wide funnel shown on Resumen General/Shopify
// (which comes from Shopify/GA4 and reflects all traffic, not just Meta ads).
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

// ============================================================================
// Biblioteca de Creativos (rediseñada 5 nov 2026 — tarjetas con imagen grande)
// ============================================================================
//
// Ranking a nivel anuncio. Filtro por audiencia, orden y top-N se resuelven
// AQUÍ (servidor) para que "Mostrando 20 de 109 anuncios" sea un conteo real:
// si el filtro/orden corriera en el navegador solo vería los N anuncios que
// ya llegaron, no los 109.
//
// Los anuncios sin gasto en el periodo se descartan (un ROAS sobre $0 de
// gasto no es una señal de ranking útil).

// Same rule as always: name contains "RTG" → Retargeting, "PRO" → Prospecting.
function classifyAudience(adName) {
  const upper = (adName || '').toUpperCase();
  if (upper.includes('RTG')) return 'Retargeting';
  if (upper.includes('PRO')) return 'Prospecting';
  return 'Sin clasificar';
}

const OBJECTIVE_LABELS = {
  OUTCOME_SALES: 'Ventas',
  CONVERSIONS: 'Ventas',
  PRODUCT_CATALOG_SALES: 'Ventas de catálogo',
  OUTCOME_LEADS: 'Clientes potenciales',
  LEAD_GENERATION: 'Clientes potenciales',
  OUTCOME_TRAFFIC: 'Tráfico',
  LINK_CLICKS: 'Tráfico',
  OUTCOME_AWARENESS: 'Reconocimiento',
  BRAND_AWARENESS: 'Reconocimiento',
  REACH: 'Alcance',
  OUTCOME_ENGAGEMENT: 'Interacción',
  POST_ENGAGEMENT: 'Interacción',
  VIDEO_VIEWS: 'Reproducciones de video',
  MESSAGES: 'Mensajes',
  OUTCOME_APP_PROMOTION: 'Promoción de app',
  APP_INSTALLS: 'Promoción de app',
};

function objectiveLabel(raw) {
  if (!raw) return null;
  if (OBJECTIVE_LABELS[raw]) return OBJECTIVE_LABELS[raw];
  const pretty = raw.replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase();
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

const CREATIVE_SORT_KEYS = [
  'roas',
  'spend',
  'purchases',
  'purchaseValue',
  'cpa',
  'uniqueCtr',
  'reach',
  'landingPageViews',
  'addToCart',
];

async function fetchAdLevelInsights(start, end, { includeObjective = true } = {}) {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const token = process.env.META_ACCESS_TOKEN;

  const fields = [
    'ad_id',
    'ad_name',
    'campaign_name',
    ...(includeObjective ? ['objective'] : []),
    'spend',
    'reach',
    'impressions',
    'frequency',
    'unique_ctr',
    'actions',
    'action_values',
  ].join(',');

  const url = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set('level', 'ad');
  url.searchParams.set('fields', fields);
  url.searchParams.set('time_range', JSON.stringify({ since: start, until: end }));
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);

  // Follow pagination (up to 6 pages) so the "de N anuncios" total stays
  // honest on long ranges instead of silently stopping at the first 500.
  const rows = [];
  let next = url.toString();
  for (let page = 0; next && page < 6; page += 1) {
    const res = await fetch(next, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const json = await res.json();
    if (!res.ok || json.error) {
      const message = json?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Meta Insights API (ad-level): ${message}`);
    }
    rows.push(...(json.data || []));
    next = json.paging?.next || null;
  }
  return rows;
}

function mapCreativeRow(row) {
  const spend = Number(row.spend) || 0;
  const landingPageViews = extractCount(row.actions, LANDING_VIEW_TYPES);
  const addToCart = extractCount(row.actions, ADD_TO_CART_TYPES);
  const addToCartValue = extractCount(row.action_values, ADD_TO_CART_TYPES);
  const initiateCheckout = extractCount(row.actions, INITIATE_CHECKOUT_TYPES);
  const purchases = extractActionValue(row.actions, 'purchase');
  const purchaseValue = extractActionValue(row.action_values, 'purchase');
  const adName = row.ad_name || '(sin nombre)';

  return {
    adId: row.ad_id,
    adName,
    campaignName: row.campaign_name || null,
    objective: objectiveLabel(row.objective),
    audience: classifyAudience(adName),
    spend,
    reach: Number(row.reach) || 0,
    impressions: Number(row.impressions) || 0,
    frequency: Number(row.frequency) || 0,
    // Meta reports unique_ctr as a percentage already (e.g. "2.31"), not a fraction.
    uniqueCtr: Number(row.unique_ctr) || 0,
    landingPageViews,
    costPerVisit: landingPageViews > 0 ? spend / landingPageViews : null,
    addToCart,
    addToCartValue,
    initiateCheckout,
    purchases,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    // null (not 0) when there were no purchases: "$0 por compra" would read
    // as free; null renders as "—" and sorts last in either direction.
    cpa: purchases > 0 ? spend / purchases : null,
  };
}

// Audience filter + sort + top-N, shared by the real and mock paths.
// Rows where the sort metric is null/undefined (e.g. cpa without purchases)
// always go last, whatever the direction.
function applyLibraryOptions(rows, { audience, sort, dir, limit }) {
  const filtered = audience && audience !== 'all' ? rows.filter((r) => r.audience === audience) : rows;
  const key = CREATIVE_SORT_KEYS.includes(sort) ? sort : 'roas';
  const sign = dir === 'asc' ? 1 : -1;

  const sorted = [...filtered].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aMissing = av === null || av === undefined || Number.isNaN(av);
    const bMissing = bv === null || bv === undefined || Number.isNaN(bv);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return (av - bv) * sign;
  });

  return { page: sorted.slice(0, limit), total: filtered.length };
}

// Old per-ad fallback: Meta's default 64×64 thumbnail. Only used for ads the
// high-res batch below couldn't resolve — better a small image than none.
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

// ---------------------------------------------------------------------------
// Imágenes de los creativos — escalera de fuentes, de mejor a peor calidad.
//
// Por qué no basta con `thumbnail_url`: Meta la entrega a 64×64 px por
// default, y estirada a una tarjeta de ~260px se ve pixelada. La forma
// confiable de obtener la imagen COMPLETA es por su `image_hash`: el creativo
// guarda el hash (en `image_hash` o en `object_story_spec.link_data`) y la
// biblioteca de imágenes de la cuenta (`/adimages`) devuelve su `url` en
// tamaño original. (`image_url` casi nunca viene en creativos hechos desde
// Ads Manager.)
//
//   1. adimages.url          imagen original   → imageSource 'adimages'
//   2. URL directa creativo  image_url / link_data.picture / video image_url …
//                                              → imageSource 'creative-url'
//   3. thumbnail_url a 600px (thumbnail_width/height) → 'thumbnail-600'
//   4. thumbnail_url default 64px             → 'thumbnail-64'
//   5. miniatura 64px pidiéndola anuncio por anuncio → 'thumbnail-64'
//
// Cada paso va en su propio try/catch: si uno falla (permiso, parámetro
// rechazado, etc.) los demás siguen y la tarjeta usa lo mejor que haya.
// `imageSource` viaja en la respuesta de la API para poder ver qué fuente se
// usó en cada anuncio sin adivinar.
// ---------------------------------------------------------------------------

async function graphGet(url, timeoutMs = 10000) {
  const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`);
  }
  return json;
}

// Pulls every place a creative can keep its image, whatever kind of ad it is
// (single image, carousel, video, dynamic creative).
function extractImageHints(creative) {
  const spec = creative?.object_story_spec || {};
  const link = spec.link_data || {};
  const photo = spec.photo_data || {};
  const video = spec.video_data || {};
  const feed = creative?.asset_feed_spec || {};
  const firstChild = Array.isArray(link.child_attachments) ? link.child_attachments[0] : null;
  const feedImage = Array.isArray(feed.images) ? feed.images[0] : null;
  const feedVideo = Array.isArray(feed.videos) ? feed.videos[0] : null;

  return {
    hash:
      creative?.image_hash ||
      link.image_hash ||
      photo.image_hash ||
      firstChild?.image_hash ||
      feedImage?.hash ||
      video.image_hash ||
      null,
    directUrl:
      creative?.image_url ||
      link.picture ||
      photo.url ||
      firstChild?.picture ||
      feedImage?.url ||
      video.image_url ||
      feedVideo?.thumbnail_url ||
      null,
    defaultThumbnail: creative?.thumbnail_url || null, // 64×64
  };
}

// Returns { [adId]: { imageUrl, thumbnailUrl, imageSource } } for the ads that
// make the page. Never throws — anything it can't resolve is simply absent and
// the caller falls back to the per-ad 64px thumbnail.
async function fetchCreativeImages(adIds) {
  const result = {};
  if (adIds.length === 0) return result;
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  // --- A) ad → creative (+ every field that can hold an image), 1 batched call.
  // If Meta rejects the big field list, retry with the minimal one.
  let adsJson = null;
  const fieldSets = [
    'creative{id,image_url,image_hash,thumbnail_url,object_story_spec,asset_feed_spec}',
    'creative{id,image_url,image_hash,thumbnail_url}',
  ];
  for (const fields of fieldSets) {
    try {
      const u = new URL(`https://graph.facebook.com/${API_VERSION}/`);
      u.searchParams.set('ids', adIds.join(','));
      u.searchParams.set('fields', fields);
      u.searchParams.set('access_token', token);
      adsJson = await graphGet(u);
      break;
    } catch (err) {
      console.warn(`[meta connector] creative lookup failed (${fields.slice(0, 40)}…):`, err.message);
    }
  }
  if (!adsJson) return result;

  const hintsByAd = {};
  const creativeIdByAd = {};
  adIds.forEach((adId) => {
    const creative = adsJson[adId]?.creative;
    if (!creative) return;
    hintsByAd[adId] = extractImageHints(creative);
    if (creative.id) creativeIdByAd[adId] = creative.id;
  });

  // --- B) hash → full-size image from the account's image library, 1 call.
  const adImageUrlByHash = {};
  const hashes = [...new Set(Object.values(hintsByAd).map((h) => h.hash).filter(Boolean))];
  if (hashes.length > 0) {
    try {
      const u = new URL(`https://graph.facebook.com/${API_VERSION}/act_${accountId}/adimages`);
      u.searchParams.set('hashes', JSON.stringify(hashes));
      u.searchParams.set('fields', 'hash,url,permalink_url');
      u.searchParams.set('limit', String(hashes.length));
      u.searchParams.set('access_token', token);
      const json = await graphGet(u);
      (json.data || []).forEach((img) => {
        if (img.hash && (img.url || img.permalink_url)) adImageUrlByHash[img.hash] = img.url || img.permalink_url;
      });
    } catch (err) {
      console.warn('[meta connector] adimages lookup failed:', err.message);
    }
  }

  // --- C) 600px thumbnail per creative, 1 batched call (separate failure domain).
  const thumb600ByCreative = {};
  const creativeIds = [...new Set(Object.values(creativeIdByAd))];
  if (creativeIds.length > 0) {
    try {
      const u = new URL(`https://graph.facebook.com/${API_VERSION}/`);
      u.searchParams.set('ids', creativeIds.join(','));
      u.searchParams.set('fields', 'thumbnail_url');
      u.searchParams.set('thumbnail_width', '600');
      u.searchParams.set('thumbnail_height', '600');
      u.searchParams.set('access_token', token);
      const json = await graphGet(u);
      creativeIds.forEach((id) => {
        if (json[id]?.thumbnail_url) thumb600ByCreative[id] = json[id].thumbnail_url;
      });
    } catch (err) {
      console.warn('[meta connector] 600px thumbnails failed:', err.message);
    }
  }

  // --- Assemble, best source first.
  const tally = {};
  adIds.forEach((adId) => {
    const hints = hintsByAd[adId];
    if (!hints) return;
    const thumb600 = thumb600ByCreative[creativeIdByAd[adId]] || null;
    const fullUrl = hints.hash ? adImageUrlByHash[hints.hash] || null : null;

    let imageUrl = null;
    let imageSource = null;
    if (fullUrl) {
      imageUrl = fullUrl;
      imageSource = 'adimages';
    } else if (hints.directUrl) {
      imageUrl = hints.directUrl;
      imageSource = 'creative-url';
    }

    const thumbnailUrl = thumb600 || hints.defaultThumbnail || null;
    if (!imageSource && thumbnailUrl) imageSource = thumb600 ? 'thumbnail-600' : 'thumbnail-64';

    if (imageUrl || thumbnailUrl) {
      result[adId] = { imageUrl, thumbnailUrl, imageSource };
      tally[imageSource] = (tally[imageSource] || 0) + 1;
    }
  });

  console.log(
    `[meta connector] creative images for ${adIds.length} ads:`,
    JSON.stringify(tally),
    `(sin resolver: ${adIds.length - Object.keys(result).length})`
  );
  return result;
}

function mockCreativeLibrary(start, end, opts) {
  const rows = mockTopCreatives(start, end, 20).map((r) => {
    const landingPageViews = r.landingPageViews || 0;
    const addToCart = Math.round(landingPageViews * 0.15);
    return {
      ...r,
      campaignName: 'Campaña de ejemplo | Ventas | CBO',
      objective: 'Ventas',
      audience: classifyAudience(r.adName),
      addToCart,
      addToCartValue: Math.round(addToCart * 480),
      initiateCheckout: Math.round(addToCart * 0.5),
      cpa: r.purchases > 0 ? r.spend / r.purchases : null,
      imageUrl: null,
      thumbnailUrl: r.thumbnailUrl || null,
    };
  });
  const { page, total } = applyLibraryOptions(rows, opts);
  return { creatives: page, total };
}

// options: { audience: 'all'|'Prospecting'|'Retargeting'|'Sin clasificar',
//            sort: one of CREATIVE_SORT_KEYS, dir: 'asc'|'desc', limit }
// → { creatives: [...top `limit`], total: ads that match the filter }
export async function getMetaCreativeLibrary(start, end, options = {}) {
  const opts = { audience: 'all', sort: 'roas', dir: 'desc', limit: 20, ...options };

  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockCreativeLibrary(start, end, opts);
  }

  let raw;
  try {
    raw = await fetchAdLevelInsights(start, end, { includeObjective: true });
  } catch (err) {
    // If Meta rejects the `objective` field for any reason, retry without it
    // — the cards just lose the objective label, they don't disappear.
    console.warn('[meta connector] ad-level insights failed, retrying without objective:', err.message);
    raw = await fetchAdLevelInsights(start, end, { includeObjective: false });
  }

  const rows = raw.map(mapCreativeRow).filter((r) => r.spend > 0);
  const { page, total } = applyLibraryOptions(rows, opts);

  const images = await fetchCreativeImages(page.map((r) => r.adId));
  const creatives = await Promise.all(
    page.map(async (r) => {
      const found = images[r.adId];
      if (found) return { ...r, ...found };
      // Last resort: Meta's default 64px thumbnail, requested ad by ad.
      const thumbnailUrl = await fetchCreativeThumbnail(r.adId);
      return {
        ...r,
        imageUrl: null,
        thumbnailUrl,
        imageSource: thumbnailUrl ? 'thumbnail-64' : 'none',
      };
    })
  );

  return { creatives, total };
}

// ============================================================================
// Gasto por Estado / por Edad y Género — Meta Ads (agregado 26 ago 2026,
// actualizado 29 sep 2026 con "visitas" + shape unificado para las donas)
// ============================================================================
//
// ⚠️ NO hay "por ciudad" para Meta: la Insights API de Meta no expone
// desglose de ciudad de forma confiable — agrega los datos a nivel estado
// por razones de privacidad y confiabilidad estadística.
//
// Edad y género SÍ se pueden combinar en una sola consulta en Meta
// (breakdowns=age,gender) — a diferencia de Google Ads, que no lo permite.
// Cada fila trae AMBAS dimensiones; la UI las separa en 2 donas (por edad,
// por género) agregando esta misma respuesta de 2 formas distintas — no se
// necesitan 2 llamadas a la API para eso.
//
// Shape unificado que regresan estas funciones (para que el mismo
// componente de dona sirva para Meta Y Google sin casos especiales):
//   { label, spend, visits, purchases, revenue, roas }
// `visits` = eventos landing_page_view del píxel. `revenue` se conserva
// (aunque no es una de las 4 métricas seleccionables en la dona) porque
// hace falta para recalcular el ROAS del bucket "Otros" correctamente
// (promedio ponderado ingreso/gasto, no un promedio simple de razones).

function round(n) {
  return Math.round(n);
}

function metaGenderLabel(g) {
  const labels = { male: 'Hombre', female: 'Mujer', unknown: 'No especificado' };
  return labels[g] || g || 'No especificado';
}

function mockMetaGeoBreakdown(start, end) {
  const ESTADOS = ['Ciudad de México', 'Jalisco', 'Nuevo León', 'Estado de México', 'Puebla', 'Querétaro', 'Veracruz', 'Sonora'];
  return ESTADOS.map((label, i) => {
    const spend = round(800 + ((i * 37 + start.length) % 10) * 250);
    const revenue = round(spend * (2 + ((i * 13) % 6)));
    const visits = round(spend / (12 + (i % 5)));
    return {
      label,
      spend,
      visits,
      purchases: Math.max(1, Math.round(revenue / 400)),
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
    };
  }).sort((a, b) => b.spend - a.spend);
}

function mockMetaDemographicsBreakdown(start, end) {
  const AGES = ['18-24', '25-34', '35-44', '45-54', '55-64'];
  const GENDERS = ['Hombre', 'Mujer'];
  const rows = [];
  AGES.forEach((ageRange, i) => {
    GENDERS.forEach((gender, j) => {
      const spend = round(400 + ((i * 29 + j * 17 + start.length) % 10) * 180);
      const revenue = round(spend * (1.8 + ((i + j) % 5)));
      const visits = round(spend / (10 + ((i + j) % 5)));
      rows.push({
        ageRange,
        gender,
        spend,
        visits,
        purchases: Math.max(1, Math.round(revenue / 400)),
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
      });
    });
  });
  return rows.sort((a, b) => b.spend - a.spend);
}

export async function getMetaGeoBreakdown(start, end) {
  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockMetaGeoBreakdown(start, end);
  }

  const url = new URL(
    `https://graph.facebook.com/${process.env.META_API_VERSION || 'v26.0'}/act_${process.env.META_AD_ACCOUNT_ID}/insights`
  );
  url.searchParams.set('access_token', process.env.META_ACCESS_TOKEN);
  url.searchParams.set('level', 'account');
  url.searchParams.set('time_range', JSON.stringify({ since: start, until: end }));
  url.searchParams.set('fields', 'spend,actions,action_values');
  url.searchParams.set('breakdowns', 'region');
  url.searchParams.set('limit', '200');

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.error_user_msg || json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta (por estado): ${message}`);
  }

  const rows = (json.data || []).map((row) => {
    const spend = Number(row.spend) || 0;
    const visits = extractCount(row.actions, LANDING_VIEW_TYPES);
    const purchases = extractActionValue(row.actions, 'purchase');
    const revenue = extractActionValue(row.action_values, 'purchase');
    return {
      label: row.region || '(sin especificar)',
      spend: round(spend),
      visits: round(visits),
      purchases: round(purchases),
      revenue: round(revenue),
      roas: spend > 0 ? revenue / spend : 0,
    };
  });

  return rows.sort((a, b) => b.spend - a.spend);
}

export async function getMetaDemographicsBreakdown(start, end) {
  if (!hasCredentials()) {
    console.warn('[meta connector] Missing META_ACCESS_TOKEN/META_AD_ACCOUNT_ID — using mock data.');
    return mockMetaDemographicsBreakdown(start, end);
  }

  const url = new URL(
    `https://graph.facebook.com/${process.env.META_API_VERSION || 'v26.0'}/act_${process.env.META_AD_ACCOUNT_ID}/insights`
  );
  url.searchParams.set('access_token', process.env.META_ACCESS_TOKEN);
  url.searchParams.set('level', 'account');
  url.searchParams.set('time_range', JSON.stringify({ since: start, until: end }));
  url.searchParams.set('fields', 'spend,actions,action_values');
  url.searchParams.set('breakdowns', 'age,gender');
  url.searchParams.set('limit', '200');

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.error_user_msg || json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta (por edad/género): ${message}`);
  }

  // NOTE: returns raw rows with BOTH ageRange and gender per row (not
  // collapsed to a single `label`) — the UI aggregates this one response
  // into a "por edad" view and a "por género" view separately.
  const rows = (json.data || []).map((row) => {
    const spend = Number(row.spend) || 0;
    const visits = extractCount(row.actions, LANDING_VIEW_TYPES);
    const purchases = extractActionValue(row.actions, 'purchase');
    const revenue = extractActionValue(row.action_values, 'purchase');
    return {
      ageRange: row.age || 'No especificado',
      gender: metaGenderLabel(row.gender),
      spend: round(spend),
      visits: round(visits),
      purchases: round(purchases),
      revenue: round(revenue),
      roas: spend > 0 ? revenue / spend : 0,
    };
  });

  return rows.sort((a, b) => b.spend - a.spend);
}
