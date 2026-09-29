'use client';

import { useEffect, useState, useMemo } from 'react';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

// Small generic sortable table, local to this file — same "⇅ on every
// column, ▲/▼ on the active one" convention as SortableTable.js and
// CreativeRankingTable.js elsewhere in the dashboard, for consistency.
function MiniSortableTable({ data, columns, error, emptyLabel = 'Sin datos para este periodo.' }) {
  const [sortKey, setSortKey] = useState(columns[1]?.key || columns[0].key);
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const copy = [...(data || [])];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (error) {
    return (
      <div className="border border-line bg-panel p-4 font-body text-sm text-fall">No se pudo cargar: {error}</div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="border border-line bg-panel p-6 text-center font-body text-sm text-ink/50">{emptyLabel}</div>
    );
  }

  return (
    <div className="overflow-x-auto border border-line bg-panel">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="rule-thick border-t-2 border-ink text-left">
            {columns.map((col) => {
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
                    <span className={isActive ? 'text-brand' : 'text-ink/25 transition-colors group-hover:text-ink/50'}>
                      {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-2.5 font-body tabular-nums ${
                    col.numeric ? 'text-ink/80' : 'font-medium text-ink'
                  }`}
                >
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const META_COLS_GEO = [
  { key: 'region', label: 'Estado' },
  { key: 'spend', label: 'Gasto', numeric: true, format: formatCurrency },
  { key: 'purchases', label: 'Compras', numeric: true, format: formatNumber },
  { key: 'purchaseValue', label: 'Valor de compras', numeric: true, format: formatCurrency },
  { key: 'roas', label: 'ROAS', numeric: true, format: formatRatio },
];
const META_COLS_DEMO = [
  { key: 'ageRange', label: 'Edad' },
  { key: 'gender', label: 'Género' },
  { key: 'spend', label: 'Gasto', numeric: true, format: formatCurrency },
  { key: 'purchases', label: 'Compras', numeric: true, format: formatNumber },
  { key: 'purchaseValue', label: 'Valor de compras', numeric: true, format: formatCurrency },
  { key: 'roas', label: 'ROAS', numeric: true, format: formatRatio },
];
const GOOGLE_COLS_GEO = (label) => [
  { key: 'location', label },
  { key: 'spend', label: 'Gasto', numeric: true, format: formatCurrency },
  { key: 'conversions', label: 'Conversiones', numeric: true, format: formatNumber },
  { key: 'conversionValue', label: 'Valor de conversión', numeric: true, format: formatCurrency },
  { key: 'roas', label: 'ROAS', numeric: true, format: formatRatio },
];
const GOOGLE_COLS_AGE = [
  { key: 'ageRange', label: 'Edad' },
  { key: 'spend', label: 'Gasto', numeric: true, format: formatCurrency },
  { key: 'conversions', label: 'Conversiones', numeric: true, format: formatNumber },
  { key: 'conversionValue', label: 'Valor de conversión', numeric: true, format: formatCurrency },
  { key: 'roas', label: 'ROAS', numeric: true, format: formatRatio },
];
const GOOGLE_COLS_GENDER = [
  { key: 'gender', label: 'Género' },
  { key: 'spend', label: 'Gasto', numeric: true, format: formatCurrency },
  { key: 'conversions', label: 'Conversiones', numeric: true, format: formatNumber },
  { key: 'conversionValue', label: 'Valor de conversión', numeric: true, format: formatCurrency },
  { key: 'roas', label: 'ROAS', numeric: true, format: formatRatio },
];

const EMPTY_META = { geo: [], demographics: [] };
const EMPTY_GOOGLE = { byRegion: [], byCity: [], byAge: [], byGender: [] };

// Self-contained: fetches its own data from the 2 new breakdown routes and
// renders everything — integrate into AdquisicionShell.js with just an
// import + a single <PaidMediaBreakdowns range={range} /> line, no other
// wiring needed.
export default function PaidMediaBreakdowns({ range }) {
  const [meta, setMeta] = useState(EMPTY_META);
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [errors, setErrors] = useState({ meta: null, google: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = `start=${range.start}&end=${range.end}`;

    Promise.all([fetchJSON(`/api/meta/breakdowns?${qs}`), fetchJSON(`/api/google/breakdowns?${qs}`)])
      .then(([metaRes, googleRes]) => {
        if (cancelled) return;
        const nextErrors = { meta: null, google: null };

        if (metaRes.error) {
          nextErrors.meta = metaRes.error;
          setMeta(EMPTY_META);
        } else {
          setMeta({ geo: metaRes.geo, demographics: metaRes.demographics });
        }

        if (googleRes.error) {
          nextErrors.google = googleRes.error;
          setGoogle(EMPTY_GOOGLE);
        } else {
          setGoogle({
            byRegion: googleRes.byRegion,
            byCity: googleRes.byCity,
            byAge: googleRes.byAge,
            byGender: googleRes.byGender,
          });
        }

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
    <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      <ErrorBanner errors={errors} />

      <SectionHeader
        eyebrow="Meta Ads"
        title="Gasto por estado"
        note="Meta no expone desglose por ciudad de forma confiable — agrega a nivel estado"
      />
      <MiniSortableTable data={meta.geo} columns={META_COLS_GEO} error={errors.meta} />

      <SectionHeader eyebrow="Meta Ads" title="Gasto por edad y género" note="Combinado en una sola tabla" />
      <MiniSortableTable data={meta.demographics} columns={META_COLS_DEMO} error={errors.meta} />

      <SectionHeader eyebrow="Google Ads" title="Gasto por estado" />
      <MiniSortableTable data={google.byRegion} columns={GOOGLE_COLS_GEO('Estado')} error={errors.google} />

      <SectionHeader eyebrow="Google Ads" title="Gasto por ciudad" />
      <MiniSortableTable data={google.byCity} columns={GOOGLE_COLS_GEO('Ciudad')} error={errors.google} />

      <SectionHeader
        eyebrow="Google Ads"
        title="Gasto por edad"
        note="Google no permite combinar edad y género en una sola consulta"
      />
      <MiniSortableTable data={google.byAge} columns={GOOGLE_COLS_AGE} error={errors.google} />

      <SectionHeader eyebrow="Google Ads" title="Gasto por género" />
      <MiniSortableTable data={google.byGender} columns={GOOGLE_COLS_GENDER} error={errors.google} />
    </div>
  );
}
