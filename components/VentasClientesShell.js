'use client';

import { useEffect, useState } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import KpiGrid from './KpiGrid';
import MonthlySpendChart from './MonthlySpendChart';
import CustomerBreakdown from './CustomerBreakdown';
import NewCustomersMonthlyChart from './NewCustomersMonthlyChart';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';
import { getPreviousRange } from '@/lib/dateRanges';
import { formatNumber } from '@/lib/format';

const EMPTY_SHOPIFY = {
  totalSales: 0,
  netSales: 0,
  orders: 0,
  newCustomers: 0,
  returningCustomers: 0,
  newCustomerRevenue: 0,
  returningCustomerRevenue: 0,
  unknownCustomerOrders: 0,
};

export default function VentasClientesShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [shopify, setShopify] = useState(EMPTY_SHOPIFY);
  const [shopifyMonthly, setShopifyMonthly] = useState([]);
  const [newCustomersMonthly, setNewCustomersMonthly] = useState([]);
  const [abandonedCheckoutsCount, setAbandonedCheckoutsCount] = useState(null);
  const [errors, setErrors] = useState({ shopify: null });
  const [previousShopify, setPreviousShopify] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const qs = `start=${range.start}&end=${range.end}`;
    const previousRange = getPreviousRange(range);
    const prevQs = previousRange ? `start=${previousRange.start}&end=${previousRange.end}&totalsOnly=1` : null;

    Promise.all([fetchJSON(`/api/shopify?${qs}`), prevQs ? fetchJSON(`/api/shopify?${prevQs}`) : null])
      .then(([shopifyRes, prevShopifyRes]) => {
        if (cancelled) return;
        const nextErrors = { shopify: null };

        if (shopifyRes.error) {
          nextErrors.shopify = shopifyRes.error;
          setShopify(EMPTY_SHOPIFY);
          setShopifyMonthly([]);
          setNewCustomersMonthly([]);
          setAbandonedCheckoutsCount(null);
        } else {
          setShopify(shopifyRes.totals);
          setShopifyMonthly(shopifyRes.monthly);
          setNewCustomersMonthly(shopifyRes.newCustomersMonthly || []);
          setAbandonedCheckoutsCount(shopifyRes.abandonedCheckoutsCount ?? null);
        }

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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Ventas y Clientes</h1>
            <p className="mt-1 text-sm text-ink/60">Datos nativos de Shopify: ventas, retención y carritos abandonados.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ErrorBanner errors={errors} />

        <SectionHeader eyebrow="KPIs" title="Indicadores clave" note={`${range.start} → ${range.end}`} />
        <KpiGrid platform="shopify" meta={{}} google={{}} shopify={shopify} blended={{}} previousShopify={previousShopify} />

        <SectionHeader eyebrow="Tendencia" title="Desglose mensual (Ene → hoy)" />
        <MonthlySpendChart data={shopifyMonthly} label="Ventas netas por mes — Shopify" barColor="#086eb6" />

        <SectionHeader eyebrow="Clientes" title="Nuevos vs. recurrentes" />
        <CustomerBreakdown shopify={shopify} />

        <SectionHeader
          eyebrow="Tendencia"
          title="Clientes nuevos por mes (Ene → hoy)"
          note="Mismo criterio que el bloque de arriba"
        />
        <NewCustomersMonthlyChart data={newCustomersMonthly} />

        <SectionHeader eyebrow="Recuperación" title="Carritos abandonados" note="Dato real de Shopify (Admin API)" />
        <div className="border border-line bg-panel p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">
            Checkouts abandonados en el periodo
          </p>
          <p className="mt-2 font-body text-2xl font-semibold tabular-nums text-ink sm:text-[28px]">
            {abandonedCheckoutsCount === null ? '—' : formatNumber(abandonedCheckoutsCount)}
          </p>
        </div>
      </main>
    </div>
  );
}
