'use client';

import { useEffect, useState } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import KpiGrid from './KpiGrid';
import MultiMetricMonthlyChart from './MultiMetricMonthlyChart';
import PlatformComparisonTable from './PlatformComparisonTable';
import TopStatesTable from './TopStatesTable';
import TopProductsTable from './TopProductsTable';
import FunnelBreakdown from './FunnelBreakdown';
import UserBehaviorPanel from './UserBehaviorPanel';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';
import { getPreviousRange, monthsSoFar, computeRangeForPreset } from '@/lib/dateRanges';
import { computeBlended } from '@/lib/metrics';

const EMPTY_META = { spend: 0, purchases: 0, purchaseValue: 0, roas: 0, cpa: 0 };
const EMPTY_GOOGLE = { spend: 0, conversions: 0, conversionValue: 0, roas: 0, cpa: 0 };
const EMPTY_SHOPIFY = {
  totalSales: 0,
  netSales: 0,
  grossSales: 0,
  orders: 0,
  newCustomers: 0,
  returningCustomers: 0,
  newCustomerRevenue: 0,
  returningCustomerRevenue: 0,
  unknownCustomerOrders: 0,
};
const EMPTY_CHECKOUT_FUNNEL = { checkoutsStarted: 0, purchases: 0 };
const EMPTY_META_FUNNEL = { pageViews: 0, addToCart: 0, checkoutInfo: 0, purchases: 0 };

// Merges Meta+Google monthly spend, Shopify's monthly net sales, and
// Shopify's monthly order count into one series — matched by month LABEL
// (not array index) so a partial/failed fetch on one platform doesn't
// silently misalign with the others' months.
function mergeExecutiveMonthly(metaMonthly, googleMonthly, shopifyMonthly) {
  const months = monthsSoFar(new Date());
  return months.map((month) => {
    const m = metaMonthly.find((x) => x.month === month);
    const g = googleMonthly.find((x) => x.month === month);
    const s = shopifyMonthly.find((x) => x.month === month);
    const metaSpend = m ? m.spend : null;
    const googleSpend = g ? g.spend : null;
    const spend = metaSpend === null || googleSpend === null ? null : (metaSpend ?? 0) + (googleSpend ?? 0);
    return {
      month,
      spend,
      salesShopify: s ? s.sales : null,
      orders: s ? s.orders : null,
    };
  });
}

export default function ResumenEjecutivoShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(EMPTY_META);
  const [metaMonthly, setMetaMonthly] = useState([]);
  const [metaFunnel, setMetaFunnel] = useState(EMPTY_META_FUNNEL);
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [googleMonthly, setGoogleMonthly] = useState([]);
  const [shopify, setShopify] = useState(EMPTY_SHOPIFY);
  const [shopifyMonthly, setShopifyMonthly] = useState([]);
  const [topStatesByMonth, setTopStatesByMonth] = useState([]);
  const [topProductsByMonth, setTopProductsByMonth] = useState([]);
  const [checkoutFunnel, setCheckoutFunnel] = useState(EMPTY_CHECKOUT_FUNNEL);
  const [errors, setErrors] = useState({ meta: null, google: null, shopify: null });
  const [previousMeta, setPreviousMeta] = useState(null);
  const [previousGoogle, setPreviousGoogle] = useState(null);
  const [previousShopify, setPreviousShopify] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const qs = `start=${range.start}&end=${range.end}`;
    const previousRange = getPreviousRange(range);
    const prevQs = previousRange ? `start=${previousRange.start}&end=${previousRange.end}&totalsOnly=1` : null;

    // "Vista congelada del mes anterior" — only meaningful when looking at
    // "Mes actual": a full, closed previous month next to the (still
    // in-progress) current month. Any other filter just shows its own range.
    const isThisMonth = range.id === 'this-month';
    const frozenPrevMonth = isThisMonth ? computeRangeForPreset('last-month') : null;
    const frozenQs = frozenPrevMonth ? `start=${frozenPrevMonth.start}&end=${frozenPrevMonth.end}&onlyTop=1` : null;

    Promise.all([
      fetchJSON(`/api/meta?${qs}`),
      fetchJSON(`/api/google?${qs}`),
      fetchJSON(`/api/shopify?${qs}`),
      prevQs ? fetchJSON(`/api/meta?${prevQs}`) : null,
      prevQs ? fetchJSON(`/api/google?${prevQs}`) : null,
      prevQs ? fetchJSON(`/api/shopify?${prevQs}`) : null,
      frozenQs ? fetchJSON(`/api/shopify?${frozenQs}`) : null,
    ])
      .then(([metaRes, googleRes, shopifyRes, prevMetaRes, prevGoogleRes, prevShopifyRes, frozenRes]) => {
        if (cancelled) return;
        const nextErrors = { meta: null, google: null, shopify: null };

        if (metaRes.error) {
          nextErrors.meta = metaRes.error;
          setMeta(EMPTY_META);
          setMetaMonthly([]);
          setMetaFunnel(EMPTY_META_FUNNEL);
        } else {
          setMeta(metaRes.totals);
          setMetaMonthly(metaRes.monthly);
          if (metaRes.funnel) setMetaFunnel(metaRes.funnel);
        }

        if (googleRes.error) {
          nextErrors.google = googleRes.error;
          setGoogle(EMPTY_GOOGLE);
          setGoogleMonthly([]);
        } else {
          setGoogle(googleRes.totals);
          setGoogleMonthly(googleRes.monthly);
        }

        if (shopifyRes.error) {
          nextErrors.shopify = shopifyRes.error;
          setShopify(EMPTY_SHOPIFY);
          setShopifyMonthly([]);
          setTopStatesByMonth([]);
          setTopProductsByMonth([]);
          setCheckoutFunnel(EMPTY_CHECKOUT_FUNNEL);
        } else {
          setShopify(shopifyRes.totals);
          setShopifyMonthly(shopifyRes.monthly);
          setCheckoutFunnel(shopifyRes.checkoutFunnel || EMPTY_CHECKOUT_FUNNEL);

          // When "Mes actual" is selected and the frozen-previous-month
          // fetch succeeded, append it as a second block — the tables
          // already render one column per block, so this just works.
          const frozenStates = frozenRes && !frozenRes.error ? frozenRes.topStatesByMonth : [];
          const frozenProducts = frozenRes && !frozenRes.error ? frozenRes.topProductsByMonth : [];
          setTopStatesByMonth([...shopifyRes.topStatesByMonth, ...frozenStates]);
          setTopProductsByMonth([...shopifyRes.topProductsByMonth, ...frozenProducts]);
          if (frozenRes?.error) {
            console.warn('[resumen ejecutivo] No se pudo cargar el mes anterior congelado:', frozenRes.error);
          }
        }

        setPreviousMeta(prevMetaRes && !prevMetaRes.error ? prevMetaRes.totals : null);
        setPreviousGoogle(prevGoogleRes && !prevGoogleRes.error ? prevGoogleRes.totals : null);
        setPreviousShopify(prevShopifyRes && !prevShopifyRes.error ? prevShopifyRes.totals : null);

        setErrors(nextErrors);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const blended = computeBlended(meta, google, shopify);
  const previousBlended =
    previousMeta && previousGoogle && previousShopify
      ? computeBlended(previousMeta, previousGoogle, previousShopify)
      : null;

  // Blended source, on purpose: "Visitas"/"Añadido al carrito" come from
  // Meta's pixel (the only real signal available — Shopify's Admin API has
  // no site-wide traffic data), while "Checkout iniciado"/"Compras" are 100%
  // real Shopify data. Labeled clearly below so nobody mistakes the top two
  // steps for total site traffic — they're Meta-attributed only.
  const funnelSteps = [
    { key: 'pageViews', label: 'Visitas a la página (Meta)', value: metaFunnel.pageViews },
    { key: 'addToCart', label: 'Añadido al carrito (Meta)', value: metaFunnel.addToCart },
    { key: 'checkoutsStarted', label: 'Checkout iniciado (Shopify)', value: checkoutFunnel.checkoutsStarted },
    { key: 'purchases', label: 'Compras (Shopify)', value: checkoutFunnel.purchases },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Resumen Ejecutivo</h1>
            <p className="mt-1 text-sm text-ink/60">Vista general directiva: ventas, gasto y eficiencia blended.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ErrorBanner errors={errors} />

        <SectionHeader eyebrow="KPIs" title="Indicadores clave" note={`${range.start} → ${range.end}`} />
        <KpiGrid
          platform="all"
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
        <MultiMetricMonthlyChart
          data={mergeExecutiveMonthly(metaMonthly, googleMonthly, shopifyMonthly)}
          label="Gasto total (Meta + Google) vs. ventas netas (Shopify) — pedidos"
          bars={[
            { dataKey: 'spend', label: 'Gasto total', color: '#086eb6', format: 'currency' },
            { dataKey: 'salesShopify', label: 'Ventas netas (Shopify)', color: '#0B2A45', format: 'currency' },
          ]}
          lines={[{ dataKey: 'orders', label: 'Pedidos', color: '#E8A33D', format: 'number' }]}
        />

        <SectionHeader eyebrow="Cruce de plataformas" title="Plataformas vs. Shopify" note="Comparación, no atribución" />
        <PlatformComparisonTable meta={meta} google={google} shopify={shopify} />

        <SectionHeader eyebrow="Comportamiento" title="Adquisición vs. Retención" />
        <UserBehaviorPanel
          shopify={shopify}
          blended={blended}
          previousShopify={previousShopify}
          previousBlended={previousBlended}
        />

        <SectionHeader
          eyebrow="Geografía"
          title="Top estados"
          note="Top 5 del periodo seleccionado arriba — con 'Mes actual' se agrega el mes anterior completo, congelado, para comparar"
        />
        <TopStatesTable data={topStatesByMonth} />

        <SectionHeader
          eyebrow="Catálogo"
          title="Top productos"
          note="Top 5 del periodo seleccionado arriba — con 'Mes actual' se agrega el mes anterior completo, congelado, para comparar"
        />
        <TopProductsTable data={topProductsByMonth} />

        <SectionHeader
          eyebrow="Funnel"
          title="Visitas → Compras"
          note="Visitas/carrito: píxel de Meta (no todo el sitio) — Checkout/compras: datos reales de Shopify"
        />
        <FunnelBreakdown steps={funnelSteps} />
      </main>
    </div>
  );
}
