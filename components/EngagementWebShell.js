'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import KpiCard from './KpiCard';
import MultiMetricMonthlyChart from './MultiMetricMonthlyChart';
import RatesMonthlyChart from './RatesMonthlyChart';
import CustomerJourneyFunnel from './CustomerJourneyFunnel';
import SortableTable from './SortableTable';
import { fetchJSON } from '@/lib/fetchJSON';
import { getPreviousRange } from '@/lib/dateRanges';
import { computeChange } from '@/lib/metrics';
import { formatNumber, formatPercent, formatDuration, formatChangeText } from '@/lib/format';

const EMPTY_KPIS = {
  usuariosTotales: 0,
  usuariosNuevos: 0,
  sesiones: 0,
  tasaConversion: 0,
  tasaRebote: 0,
  tasaAtc: 0,
  duracionMedia: 0,
  checkoutsIniciados: 0,
  checkoutsCompletados: 0,
};

// Same "pick the largest divisor <= 6" trick as KpiGrid.js, so N cards land
// on a clean grid instead of leaving empty cells.
function bestColumnCount(count) {
  for (let cols = 6; cols >= 2; cols--) {
    if (count % cols === 0) return cols;
  }
  return Math.min(count, 4);
}
const GRID_COLS_CLASS = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' };

function buildCard(label, current, previous, format) {
  const change = computeChange(current, previous);
  return { label, value: format(current), changeText: formatChangeText(change, format), direction: change?.direction };
}

export default function EngagementWebShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(EMPTY_KPIS);
  const [previousKpis, setPreviousKpis] = useState(null);
  const [monthlyVisitorsSessions, setMonthlyVisitorsSessions] = useState([]);
  const [monthlyRates, setMonthlyRates] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [monthlyDetail, setMonthlyDetail] = useState([]);
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const qs = `start=${range.start}&end=${range.end}`;
    const previousRange = getPreviousRange(range);
    const prevQs = previousRange ? `start=${previousRange.start}&end=${previousRange.end}&totalsOnly=1` : null;

    Promise.all([fetchJSON(`/api/ga4/engagement?${qs}`), prevQs ? fetchJSON(`/api/ga4/engagement?${prevQs}`) : null])
      .then(([res, prevRes]) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setKpis(EMPTY_KPIS);
        } else {
          setError(null);
          setKpis(res.kpis);
          setMonthlyVisitorsSessions(res.monthlyVisitorsSessions || []);
          setMonthlyRates(res.monthlyRates || []);
          setFunnel(res.funnel || []);
          setMonthlyDetail(res.monthlyDetail || []);
        }
        setPreviousKpis(prevRes && !prevRes.error ? prevRes.kpis : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const cards = [
    buildCard('Usuarios Totales', kpis.usuariosTotales, previousKpis?.usuariosTotales, formatNumber),
    buildCard('Usuarios Nuevos', kpis.usuariosNuevos, previousKpis?.usuariosNuevos, formatNumber),
    buildCard('Sesiones Totales', kpis.sesiones, previousKpis?.sesiones, formatNumber),
    buildCard('Tasa de Conversión', kpis.tasaConversion, previousKpis?.tasaConversion, formatPercent),
    buildCard('Tasa de Rebote', kpis.tasaRebote, previousKpis?.tasaRebote, formatPercent),
    buildCard('Tasa de Add to Cart', kpis.tasaAtc, previousKpis?.tasaAtc, formatPercent),
    buildCard('Duración Media Sesión', kpis.duracionMedia, previousKpis?.duracionMedia, formatDuration),
    buildCard('Checkouts Iniciados', kpis.checkoutsIniciados, previousKpis?.checkoutsIniciados, formatNumber),
    buildCard('Checkouts Completados', kpis.checkoutsCompletados, previousKpis?.checkoutsCompletados, formatNumber),
  ];
  const lgColsClass = GRID_COLS_CLASS[bestColumnCount(cards.length)] || 'lg:grid-cols-4';

  // Years available in the fetched detail table, newest first — the
  // dropdown only ever shows years that actually have data.
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(monthlyDetail.map((row) => row.year))).sort((a, b) => b - a);
    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [monthlyDetail]);
  const filteredDetail = monthlyDetail.filter((row) => row.year === detailYear);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Engagement Web</h1>
            <p className="mt-1 text-sm text-ink/60">Cómo se comporta la gente una vez que llega — Google Analytics 4.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {error && <ErrorBanner errors={{ analytics: error }} />}

        <SectionHeader eyebrow="KPIs" title="Indicadores clave" note={`${range.start} → ${range.end}`} />
        <div className={`grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 ${lgColsClass}`}>
          {cards.map((c) => (
            <KpiCard key={c.label} label={c.label} value={c.value} changeText={c.changeText} direction={c.direction} />
          ))}
        </div>

        <SectionHeader
          eyebrow="Tendencia"
          title="Usuarios y Sesiones — por mes"
          note="Últimos 12 meses — no cambia con el filtro de arriba"
        />
        <MultiMetricMonthlyChart
          data={monthlyVisitorsSessions}
          label="Usuarios y sesiones por mes"
          bars={[
            { dataKey: 'sessions', label: 'Sesiones', color: '#086eb6', format: 'number' },
            { dataKey: 'visitors', label: 'Usuarios Totales', color: '#0B2A45', format: 'number' },
          ]}
        />

        <SectionHeader
          eyebrow="Tendencia"
          title="Tasas de Conversión, ATC y Rebote"
          note="Últimos 12 meses — no cambia con el filtro de arriba"
        />
        <RatesMonthlyChart data={monthlyRates} />

        <SectionHeader eyebrow="Funnel" title="Customer Journey" note={`${range.start} → ${range.end}`} />
        <CustomerJourneyFunnel steps={funnel} />

        <SectionHeader eyebrow="Detalle" title="Tabla mensual" note="8 métricas" />
        <div className="mb-3 flex flex-wrap gap-2">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setDetailYear(y)}
              className={[
                'rounded-full border px-3 py-1.5 font-body text-xs uppercase tracking-wide transition-colors',
                detailYear === y
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-panel text-ink/70 hover:border-brand/50',
              ].join(' ')}
            >
              {y}
            </button>
          ))}
        </div>
        <SortableTable data={filteredDetail} keyLabel="Mes" />
      </main>
    </div>
  );
}
