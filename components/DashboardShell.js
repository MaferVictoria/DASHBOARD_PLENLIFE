'use client';

import { useEffect, useState } from 'react';
import DateRangeSelector from './DateRangeSelector';
import KpiGrid from './KpiGrid';
import MonthlySpendChart from './MonthlySpendChart';
import ComboMonthlyChart from './ComboMonthlyChart';
import PlatformComparisonTable from './PlatformComparisonTable';
import TopCitiesTable from './TopCitiesTable';
import TopProductsTable from './TopProductsTable';
import FunnelBreakdown from './FunnelBreakdown';
import CustomerBreakdown from './CustomerBreakdown';
import SectionHeader from './SectionHeader';
import { defaultRange, getPreviousRange, monthsSoFar } from '@/lib/dateRanges';
import { computeBlended } from '@/lib/metrics';

const EMPTY_META = { spend: 0, purchases: 0, purchaseValue: 0, roas: 0, cpa: 0 };
const EMPTY_GOOGLE = { spend: 0, conversions: 0, conversionValue: 0, roas: 0, cpa: 0 };
const EMPTY_SHOPIFY = {
  totalSales: 0,
  netSales: 0,
  orders: 0,
  newCustomers: 0,
  returningCustomers: 0,
  newCustomerRevenue: 0,
};
const EMPTY_FUNNEL = { pageViews: 0, addToCart: 0, checkoutInfo: 0, purchases: 0 };

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

// Merges two {month, spend}-shaped arrays into combined ad spend, matched by
// month LABEL (not array index) so a partial/failed fetch on one platform
// doesn't silently misalign with the other's months.
function mergeMonthlySpendAndSales(metaMonthly, googleMonthly, shopifyMonthly) {
  const months = monthsSoFar(new Date());
  return months.map((month) => {
    const m = metaMonthly.find((x) => x.month === month);
    const g = googleMonthly.find((x) => x.month === month);
    const s = shopifyMonthly.find((x) => x.month === month);
    const metaSpend = m ? m.spend : null;
    const googleSpend = g ? g.spend : null;
    const spend = metaSpend === null || googleSpend === null ? null : (metaSpend ?? 0) + (googleSpend ?? 0);
    return { month, spend, sales: s ? s.value : null };
  });
}

// platform: 'all' | 'meta' | 'google' | 'shopify'
// title/subtitle: copy shown at the top of the page for this tab.
export default function DashboardShell({ platform, title, subtitle }) {
  const [range, setRange] = useState(defaultRange());
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(EMPTY_META);
  const [metaMonthly, setMetaMonthly] = useState([]);
  const [metaFunnel, setMetaFunnel] = useState(EMPTY_FUNNEL);
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [googleMonthly, setGoogleMonthly] = useState([]);
  const [shopify, setShopify] = useState(EMPTY_SHOPIFY);
  const [shopifyMonthly, setShopifyMonthly] = useState([]);
  const [topCitiesByMonth, setTopCitiesByMonth] = useState([]);
  const [topProductsByMonth, setTopProductsByMonth] = useState([]);
  const [siteFunnel, setSiteFunnel] = useState(EMPTY_FUNNEL);
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
            setMetaFunnel(EMPTY_FUNNEL);
          } else {
            setMeta(metaRes.totals);
            setMetaMonthly(metaRes.monthly);
            if (metaRes.funnel) setMetaFunnel(metaRes.funnel);
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
            setSiteFunnel(shopifyRes.funnel);
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
  const showCitiesProducts = platform === 'all';
  const showSiteFunnel = platform === 'all' || platform === 'shopify';
  const showMetaFunnel = platform === 'meta';
  const showCustomerBreakdown = platform === 'shopify';

  let monthlyChart = null;
  if (platform === 'meta') {
    monthlyChart = (
      <ComboMonthlyChart
        data={metaMonthly}
        label="Gasto vs. ventas generadas — Meta Ads"
        spendLabel="Gasto"
        salesLabel="Ventas generadas"
        spendColor="#086eb6"
        salesColor="#009dde"
      />
    );
  } else if (platform === 'google') {
    monthlyChart = (
      <ComboMonthlyChart
        data={googleMonthly}
        label="Gasto vs. ventas generadas — Google Ads (PMax)"
        spendLabel="Gasto"
        salesLabel="Ventas generadas"
        spendColor="#086eb6"
        salesColor="#009dde"
      />
    );
  } else if (platform === 'shopify') {
    monthlyChart = <MonthlySpendChart data={shopifyMonthly} label="Ventas netas por mes — Shopify" barColor="#086eb6" />;
  } else {
    monthlyChart = (
      <ComboMonthlyChart
        data={mergeMonthlySpendAndSales(metaMonthly, googleMonthly, shopifyMonthly)}
        label="Gasto total (Meta + Google) vs. ventas — Shopify"
        spendLabel="Gasto total"
        salesLabel="Ventas (Shopify)"
        spendColor="#086eb6"
        salesColor="#009dde"
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
          </div>
          <DateRangeSelector range={range} onChange={setRange} />
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
            <SectionHeader eyebrow="Geografía" title="Top ciudades por mes" note="Top 5 — mes actual y anterior" />
            <TopCitiesTable data={topCitiesByMonth} />

            <SectionHeader eyebrow="Catálogo" title="Top productos por mes" note="Top 5 — mes actual y anterior" />
            <TopProductsTable data={topProductsByMonth} />
          </>
        )}

        {showCustomerBreakdown && (
          <>
            <SectionHeader eyebrow="Clientes" title="Nuevos vs. recurrentes" />
            <CustomerBreakdown shopify={shopify} />
          </>
        )}

        {showMetaFunnel && (
          <>
            <SectionHeader
              eyebrow="Funnel"
              title="Funnel de Meta Ads"
              note="Datos del píxel de Meta, no del sitio completo"
            />
            <FunnelBreakdown funnel={metaFunnel} />
          </>
        )}

        {showSiteFunnel && (
          <>
            <SectionHeader eyebrow="Sitio" title="Funnel: visitas → compra" />
            <FunnelBreakdown funnel={siteFunnel} />
          </>
        )}
      </main>
    </div>
  );
}
