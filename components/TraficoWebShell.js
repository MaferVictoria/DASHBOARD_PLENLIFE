'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import ChannelDonutChart from './ChannelDonutChart';
import SortableTable from './SortableTable';
import { fetchJSON } from '@/lib/fetchJSON';
import { formatNumber } from '@/lib/format';

// Simpler 4-column table (Fuente/Sesiones/Usuarios Totales/% del total) —
// the 8-metric SortableTable would be the wrong shape here and mostly show
// dashes. Same sort convention as SortableTable.js and CreativeRankingTable
// (⇅ on every column, ▲/▼ on the active one) so it behaves consistently
// with every other table in the dashboard.
const CHANNEL_COLUMNS = [
  { key: 'source', label: 'Fuente' },
  { key: 'sessions', label: 'Sesiones' },
  { key: 'usuariosTotales', label: 'Usuarios Totales' },
  { key: 'pct', label: '% del total' },
];

function ChannelSourceTable({ rows }) {
  const [sortKey, setSortKey] = useState('sessions');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const copy = [...(rows || [])];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="border border-line bg-panel p-6 text-center font-body text-sm text-ink/50">
        Sin datos para este periodo.
      </div>
    );
  }

  return (
    <div className="border border-line bg-panel">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="rule-thick border-t-2 border-ink text-left">
            {CHANNEL_COLUMNS.map((col) => {
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  title="Clic para ordenar — clic de nuevo para invertir"
                  className="group cursor-pointer select-none whitespace-nowrap px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60 hover:text-brand"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <span
                      className={
                        isActive ? 'text-brand' : 'text-ink/25 transition-colors group-hover:text-ink/50'
                      }
                    >
                      {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.source} className="border-t border-line">
              <td className="px-4 py-2.5 font-medium text-ink">{r.source}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(r.sessions)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(r.usuariosTotales)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{r.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EMPTY_CHANNEL = { donut: [], sourceTable: [] };
const EMPTY_UTM = { sourceMedium: [], campaign: [], source: [], adContent: [] };

export default function TraficoWebShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(EMPTY_CHANNEL);
  const [utm, setUtm] = useState(EMPTY_UTM);
  const [utmErrors, setUtmErrors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJSON(`/api/ga4/traffic?start=${range.start}&end=${range.end}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setChannel(EMPTY_CHANNEL);
          setUtm(EMPTY_UTM);
          return;
        }
        setError(null);
        setChannel(res.channel?.error ? EMPTY_CHANNEL : res.channel);
        setUtm({
          sourceMedium: res.utm.sourceMedium,
          campaign: res.utm.campaign,
          source: res.utm.source,
          adContent: res.utm.adContent,
        });
        setUtmErrors({
          sourceMedium: res.utm.sourceMediumError,
          campaign: res.utm.campaignError,
          source: res.utm.sourceError,
          adContent: res.utm.adContentError,
        });
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
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Tráfico Web</h1>
            <p className="mt-1 text-sm text-ink/60">De dónde viene el tráfico del sitio — Google Analytics 4.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {error && <ErrorBanner errors={{ analytics: error }} />}

        <SectionHeader eyebrow="Canales" title="Tráfico por Canal" note={`${range.start} → ${range.end}`} />
        <ChannelDonutChart data={channel.donut} />
        <div className="mt-3">
          <ChannelSourceTable rows={channel.sourceTable} />
        </div>

        <SectionHeader
          eyebrow="UTM"
          title="Fuente / Medio de la Sesión"
          note="Top 10 — clic en un encabezado para ordenar, 'Ver todos' para el resto"
        />
        <SortableTable data={utm.sourceMedium} error={utmErrors.sourceMedium} keyLabel="Fuente / Medio" initialLimit={10} />

        <SectionHeader eyebrow="UTM" title="Campaña de la Sesión" />
        <SortableTable data={utm.campaign} error={utmErrors.campaign} keyLabel="Campaña" initialLimit={10} />

        <SectionHeader eyebrow="UTM" title="Fuente de la Sesión" />
        <SortableTable data={utm.source} error={utmErrors.source} keyLabel="Fuente" initialLimit={10} />

        <SectionHeader eyebrow="UTM" title="Contenido de la Sesión" note="utm_content" />
        <SortableTable data={utm.adContent} error={utmErrors.adContent} keyLabel="Contenido" initialLimit={10} />
      </main>
    </div>
  );
}
