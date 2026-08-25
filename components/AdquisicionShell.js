'use client';

import { useEffect, useState } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import KpiGrid from './KpiGrid';
import MultiMetricMonthlyChart from './MultiMetricMonthlyChart';
import FunnelBreakdown from './FunnelBreakdown';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';
import { getPreviousRange } from '@/lib/dateRanges';

const EMPTY_META = { spend: 0, purchases: 0, purchaseValue: 0, roas: 0, cpa: 0 };
const EMPTY_GOOGLE = { spend: 0, conversions: 0, conversionValue: 0, roas: 0, cpa: 0 };
const EMPTY_META_FUNNEL = { pageViews: 0, addToCart: 0, checkoutInfo: 0, purchases: 0 };
const EMPTY_GOOGLE_FUNNEL = { clicks: 0, addToCart: 0, beginCheckout: 0, purchases: 0 };

// Adds a per-month ROAS line (ventas atribuidas / gasto) to a monthly
// {month, spend, sales, orders} series. A failed month (spend === null)
// stays null here too, so MultiMetricMonthlyChart's gap styling still works.
function withMonthlyRoas(monthly) {
  return monthly.map((m) => ({
    ...m,
    roas: m.spend === null || m.spend === undefined ? null : m.spend > 0 ? (m.sales ?? 0) / m.spend : 0,
  }));
}

export default function AdquisicionShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(EMPTY_META);
  const [metaMonthly, setMetaMonthly] = useState([]);
  const [metaFunnel, setMetaFunnel] = useState(EMPTY_META_FUNNEL);
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [googleMonthly, setGoogleMonthly] = useState([]);
  const [googleFunnel, setGoogleFunnel] = useState(EMPTY_GOOGLE_FUNNEL);
  const [errors, setErrors] = useState({ meta: null, google: null });
  const [previousMeta, setPreviousMeta] = useState(null);
  const [previousGoogle, setPreviousGoogle] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const qs = `start=${range.start}&end=${range.end}`;
    const previousRange = getPreviousRange(range);
    const prevQs = previousRange ? `start=${previousRange.start}&end=${previousRange.end}&totalsOnly=1` : null;

    Promise.all([
      fetchJSON(`/api/meta?${qs}`),
      fetchJSON(`/api/google?${qs}`),
      prevQs ? fetchJSON(`/api/meta?${prevQs}`) : null,
      prevQs ? fetchJSON(`/api/google?${prevQs}`) : null,
    ])
      .then(([metaRes, googleRes, prevMetaRes, prevGoogleRes]) => {
        if (cancelled) return;
        const nextErrors = { meta: null, google: null };

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
          setGoogleFunnel(EMPTY_GOOGLE_FUNNEL);
        } else {
          setGoogle(googleRes.totals);
          setGoogleMonthly(googleRes.monthly);
          if (googleRes.funnel) setGoogleFunnel(googleRes.funnel);
        }

        setPreviousMeta(prevMetaRes && !prevMetaRes.error ? prevMetaRes.totals : null);
        setPreviousGoogle(prevGoogleRes && !prevGoogleRes.error ? prevGoogleRes.totals : null);

        setErrors(nextErrors);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const metaFunnelSteps = [
    { key: 'pageViews', label: 'Visitas a la página', value: metaFunnel.pageViews },
    { key: 'addToCart', label: 'Añadido al carrito', value: metaFunnel.addToCart },
    { key: 'checkoutInfo', label: 'Información de pago', value: metaFunnel.checkoutInfo },
    { key: 'purchases', label: 'Compras', value: metaFunnel.purchases },
  ];

  const googleFunnelSteps = [
    { key: 'clicks', label: 'Clics', value: googleFunnel.clicks },
    { key: 'addToCart', label: 'Añadido al carrito', value: googleFunnel.addToCart },
    { key: 'beginCheckout', label: 'Checkout iniciado', value: googleFunnel.beginCheckout },
    { key: 'purchases', label: 'Compras', value: googleFunnel.purchases },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Adquisición / Paid Media</h1>
            <p className="mt-1 text-sm text-ink/60">Meta y Google consolidados: rendimiento, costos y embudos.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ErrorBanner errors={errors} />

        {/* Meta Ads — blue family, to visually distinguish from Google below */}
        <SectionHeader eyebrow="Meta Ads" title="Indicadores clave" note={`${range.start} → ${range.end}`} />
        <KpiGrid platform="meta" meta={meta} google={google} shopify={{}} blended={{}} previousMeta={previousMeta} />

        <MultiMetricMonthlyChart
          data={withMonthlyRoas(metaMonthly)}
          label="Gasto vs. ventas atribuidas — pedidos y ROAS — Meta Ads"
          bars={[
            { dataKey: 'spend', label: 'Gasto', color: '#086eb6', format: 'currency' },
            { dataKey: 'sales', label: 'Ventas atribuidas', color: '#4A9FD8', format: 'currency' },
          ]}
          lines={[
            { dataKey: 'orders', label: 'Pedidos', color: '#E8A33D', format: 'number' },
            { dataKey: 'roas', label: 'ROAS promedio', color: '#8B5CF6', format: 'ratio' },
          ]}
        />

        <SectionHeader eyebrow="Funnel" title="Funnel de Meta Ads" note="Datos del píxel de Meta, no del sitio completo" />
        <FunnelBreakdown steps={metaFunnelSteps} />

        {/* Google Ads — green family, deliberately different from Meta's blue */}
        <SectionHeader eyebrow="Google Ads (PMax)" title="Indicadores clave" note={`${range.start} → ${range.end}`} />
        <KpiGrid platform="google" meta={meta} google={google} shopify={{}} blended={{}} previousGoogle={previousGoogle} />

        <MultiMetricMonthlyChart
          data={withMonthlyRoas(googleMonthly)}
          label="Gasto vs. ventas atribuidas — pedidos y ROAS — Google Ads (PMax)"
          bars={[
            { dataKey: 'spend', label: 'Gasto', color: '#1F7A5C', format: 'currency' },
            { dataKey: 'sales', label: 'Ventas atribuidas', color: '#34B37A', format: 'currency' },
          ]}
          lines={[
            { dataKey: 'orders', label: 'Pedidos', color: '#E8A33D', format: 'number' },
            { dataKey: 'roas', label: 'ROAS promedio', color: '#8B5CF6', format: 'ratio' },
          ]}
        />

        <SectionHeader
          eyebrow="Funnel"
          title="Funnel de Google Ads"
          note="Depende de cómo estén configuradas tus conversiones"
        />
        <FunnelBreakdown steps={googleFunnelSteps} />
      </main>
    </div>
  );
}
