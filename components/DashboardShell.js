'use client';

import { useEffect, useState } from 'react';
import TabNav from './TabNav';
import DateRangeSelector from './DateRangeSelector';
import KpiGrid from './KpiGrid';
import MonthlySpendChart from './MonthlySpendChart';
import PlatformComparisonTable from './PlatformComparisonTable';
import TopCitiesTable from './TopCitiesTable';
import TopProductsTable from './TopProductsTable';
import FunnelBreakdown from './FunnelBreakdown';
import SectionHeader from './SectionHeader';
import { defaultRange, getPreviousRange } from '@/lib/dateRanges';
import { computeBlended } from '@/lib/metrics';

const EMPTY_META = { spend: 0, purchases: 0, purchaseValue: 0, roas: 0, cpa: 0 };
const EMPTY_GOOGLE = { spend: 0, conversions: 0, conversionValue: 0, roas: 0, cpa: 0 };
const EMPTY_SHOPIFY = { totalSales: 0, netSales: 0, orders: 0, newCustomers: 0, returningCustomers: 0 };

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: json.error || `Error ${res.status} al consultar ${url}` };
    }
    return json;
  } catch (err) {
    return { error: err.message || `No se pudo conectar con ${url}` };
  }
}

const PLATFORM_NAMES = { meta: 'Meta Ads', google: 'Google Ads', shopify: 'Shopify' };

function ErrorBanner({ errors }) {
  const entries = Object.entries(errors).filter(([, msg]) => msg);
  if (entries.length === 0) return null;
  return (
    <div className="mb-6 space-y-1 border border-fall/30 bg-fall/5 px-4 py-3">
      {entries.map(([key, msg]) => (
        <p key={key} className="font-body text-xs text-fall">
          <span className="font-semibold">{PLATFORM_NAMES[key]}:</span> {msg}
        </p>
      ))}
    </div>
  );
}

// platform: 'all' | 'meta' | 'google' | 'shopify'
// title/subtitle: copy shown at the top of the page for this tab.
export default function DashboardShell({ platform, title, subtitle }) {
  const [range, setRange] = useState(defaultRange());
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(EMPTY_META);
  const [metaMonthly, setMetaMonthly] = useState([]);
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [googleMonthly, setGoogleMonthly] = useState([]);
  const [shopify, setShopify] = useState(EMPTY_SHOPIFY);
  const [shopifyMonthly, setShopifyMonthly] = useState([]);
  const [topCitiesByMonth, setTopCitiesByMonth] = useState([]);
  const [topProductsByMonth, setTopProductsByMonth] = useState([]);
  const [funnel, setFunnel] = useState({ pageViews: 0, addToCart: 0, checkoutInfo: 0, purchases: 0 });
  const [errors, setErrors] = useState({ meta: null, google: null, shopify: null });
  const [previousMeta, setPreviousMeta] = useState(null);
  const [previousGoogle, setPreviousGoogle] = useState(null);
  const [previousShopify, setPreviousShopify] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const qs = `start=${range.start}&end=${range.end}`;
    const needsMeta = platform === 'all' || platform === 'meta';
    const needsGoogle = platform === 'all' || platform === 'google';
    const needsShopify = platform === 'all' || platform === 'shopify';

    // "Todo el histórico" has no meaningful previous period to compare
    // against — getPreviousRange returns null and we simply skip these.
    const previousRange = getPreviousRange(range);
    const prevQs = previousRange ? `start=${previousRange.start}&end=${previousRange.end}&totalsOnly=1` : null;

    Promise.all([
      needsMeta ? fetchJSON(`/api/meta?${qs}`) : null,
      needsGoogle ? fetchJSON(`/api/google?${qs}`) : null,
      needsShopify ? fetchJSON(`/api/shopify?${qs}`) : null,
      needsMeta && prevQs ? fetchJSON(`/api/meta?${prevQs}`) : null,
      needsGoogle && prevQs ? fetchJSON(`/api/google?${prevQs}`) : null,
      needsShopify && prevQs ? fetchJSON(`/api/shopify?${prevQs}`) : null,
    ])
      .then(([metaRes, googleRes, shopifyRes, prevMetaRes, prevGoogleRes, prevShopifyRes]) => {
        if (cancelled) return;
        const nextErrors = { meta: null, google: null, shopify: null };

        if (metaRes) {
          if (metaRes.error) {
            nextErrors.meta = metaRes.error;
            setMeta(EMPTY_META);
            setMetaMonthly([]);
          } else {
            setMeta(metaRes.totals);
            setMetaMonthly(metaRes.monthly);
          }
        }
        if (googleRes) {
          if (googleRes.error) {
            nextErrors.google = googleRes.error;
            setGoogle(EMPTY_GOOGLE);
            setGoogleMonthly([]);
          } else {
            setGoogle(googleRes.totals);
            setGoogleMonthly(googleRes.monthly);
          }
        }
        if (shopifyRes) {
          if (shopifyRes.error) {
            nextErrors.shopify = shopifyRes.error;
            setShopify(EMPTY_SHOPIFY);
            setShopifyMonthly([]);
            setTopCitiesByMonth([]);
            setTopProductsByMonth([]);
          } else {
            setShopify(shopifyRes.totals);
            setShopifyMonthly(shopifyRes.monthly);
            setTopCitiesByMonth(shopifyRes.topCitiesByMonth);
            setTopProductsByMonth(shopifyRes.topProductsByMonth);
            setFunnel(shopifyRes.funnel);
          }
        }

        // A failed comparison fetch should only hide the % change, never
        // block the current-period KPIs — so these don't feed the red banner.
        setPreviousMeta(prevMetaRes && !prevMetaRes.error ? prevMetaRes.totals : null);
        setPreviousGoogle(prevGoogleRes && !prevGoogleRes.error ? prevGoogleRes.totals : null);
        setPreviousShopify(prevShopifyRes && !prevShopifyRes.error ? prevShopifyRes.totals : null);
        if (prevMetaRes?.error) console.warn('[comparación] Meta (periodo anterior):', prevMetaRes.error);
        if (prevGoogleRes?.error) console.warn('[comparación] Google (periodo anterior):', prevGoogleRes.error);
        if (prevShopifyRes?.error) console.warn('[comparación] Shopify (periodo anterior):', prevShopifyRes.error);

        setErrors(nextErrors);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [platform, range.start, range.end]);

  const blended = computeBlended(meta, google, shopify);
  const previousBlended =
    previousMeta && previousGoogle && previousShopify
      ? computeBlended(previousMeta, previousGoogle, previousShopify)
      : null;

  const showComparison = platform === 'all';
  const showCitiesProducts = platform === 'all' || platform === 'shopify';
  const showFunnel = platform === 'all' || platform === 'shopify';

  let monthlyChart = null;
  if (platform === 'meta') {
    monthlyChart = <MonthlySpendChart data={metaMonthly} label="Gasto por mes — Meta Ads" barColor="#086eb6" />;
  } else if (platform === 'google') {
    monthlyChart = <MonthlySpendChart data={googleMonthly} label="Gasto por mes — Google Ads (PMax)" barColor="#009dde" />;
  } else if (platform === 'shopify') {
    monthlyChart = <MonthlySpendChart data={shopifyMonthly} label="Ventas netas por mes — Shopify" barColor="#0B2A45" />;
  } else {
    monthlyChart = (
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <MonthlySpendChart data={metaMonthly} label="Gasto por mes — Meta Ads" barColor="#086eb6" />
        <MonthlySpendChart data={googleMonthly} label="Gasto por mes — Google Ads (PMax)" barColor="#009dde" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.18em] text-brand-bright">Plenlife</p>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
          </div>
          <DateRangeSelector range={range} onChange={setRange} />
        </div>
        <div className="mt-4">
          <TabNav />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ErrorBanner errors={errors} />

        <SectionHeader eyebrow="KPIs" title="Indicadores clave" note={`${range.start} → ${range.end}`} />
        <KpiGrid
          platform={platform}
          meta={meta}
          google={google}
          shopify={shopify}
          blended={blended}
          previousMeta={previousMeta}
          previousGoogle={previousGoogle}
          previousShopify={previousShopify}
          previousBlended={previousBlended}
        />

        <SectionHeader eyebrow="Tendencia" title="Desglose mensual (Ene → hoy)" />
        {monthlyChart}

        {showComparison && (
          <>
            <SectionHeader
              eyebrow="Cruce de plataformas"
              title="Plataformas vs. Shopify"
              note="Comparación, no atribución"
            />
            <PlatformComparisonTable meta={meta} google={google} shopify={shopify} />
          </>
        )}

        {showCitiesProducts && (
          <>
            <SectionHeader eyebrow="Geografía" title="Top ciudades por mes" />
            <TopCitiesTable data={topCitiesByMonth} />

            <SectionHeader eyebrow="Catálogo" title="Top productos por mes" />
            <TopProductsTable data={topProductsByMonth} />
          </>
        )}

        {showFunnel && (
          <>
            <SectionHeader eyebrow="Sitio" title="Funnel: visitas → compra" />
            <FunnelBreakdown funnel={funnel} />
          </>
        )}
      </main>
    </div>
  );
}
