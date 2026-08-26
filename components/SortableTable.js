'use client';

import { useState, useMemo } from 'react';
import { formatNumber, formatPercent, formatDuration } from '@/lib/format';

const COLUMNS = [
  { key: 'key', label: null, format: (v) => v },
  { key: 'usuariosTotales', label: 'Usuarios Totales', format: formatNumber },
  { key: 'sesiones', label: 'Sesiones', format: formatNumber },
  { key: 'tasaConversion', label: 'Tasa Conv.', format: formatPercent },
  { key: 'tasaAtc', label: 'Tasa ATC', format: formatPercent },
  { key: 'tasaRebote', label: 'Tasa Rebote', format: formatPercent },
  { key: 'duracionMedia', label: 'Dur. Media', format: formatDuration },
  { key: 'checkoutsIniciados', label: 'Checkouts Iniciados', format: formatNumber },
  { key: 'checkoutsCompletados', label: 'Compras', format: formatNumber },
];

// Every UTM breakdown table AND the monthly detail table share this exact
// 8-metric shape (+ one dimension "key" column) — one sortable component,
// click any header to sort by it (click again to flip direction).
//
// `initialLimit`: when set (e.g. 10 for the 4 UTM tables), only the top N
// rows of the CURRENT sort show by default, with a "Ver los N restantes"
// toggle below to reveal the rest inline. Omit it (monthly detail table)
// to always show everything.
//
// `defaultSortKey`/`defaultSortDir`: what the table sorts by BEFORE anyone
// clicks a header. UTM tables want "Sesiones" desc (biggest first);
// the monthly detail table wants chronological, most recent first —
// pass `defaultSortKey="key"` `defaultSortDir="desc"` for that case.
//
// `dateSortField`: the monthly detail table's displayed "Mes" column shows
// a label like "Feb 2026", which sorts WRONG alphabetically (Abr before
// Ago before Dic before Ene...). Pass the name of a separate, real
// chronologically-sortable field (e.g. "monthKey": "202602") and clicking/
// defaulting to the "key" column will sort by THAT field instead, while
// still displaying the friendly label. Omit for tables where the "key"
// column is just a plain dimension name (UTM tables) — plain alphabetical
// sort is correct there.
export default function SortableTable({
  data,
  keyLabel = 'Valor',
  error,
  initialLimit = null,
  defaultSortKey = 'sesiones',
  defaultSortDir = 'desc',
  dateSortField = null,
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...(data || [])];
    const field = sortKey === 'key' && dateSortField ? dateSortField : sortKey;
    copy.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [data, sortKey, sortDir, dateSortField]);

  const hasMore = initialLimit && sorted.length > initialLimit;
  const visible = hasMore && !expanded ? sorted.slice(0, initialLimit) : sorted;

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
      <div className="border border-line bg-panel p-4 font-body text-sm text-fall">
        No se pudo cargar esta dimensión: {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="border border-line bg-panel p-6 text-center font-body text-sm text-ink/50">
        Sin datos para este periodo.
      </div>
    );
  }

  return (
    <div className="border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="rule-thick border-t-2 border-ink text-left">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="cursor-pointer select-none whitespace-nowrap px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60 hover:text-brand"
                >
                  {col.key === 'key' ? keyLabel : col.label}
                  {sortKey === col.key && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={`${row.key}-${i}`} className="border-t border-line">
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 font-body tabular-nums ${
                      col.key === 'key' ? 'max-w-[220px] truncate font-medium text-ink' : 'text-ink/80'
                    }`}
                    title={col.key === 'key' ? row[col.key] : undefined}
                  >
                    {col.format(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full border-t border-line px-4 py-2 text-center font-body text-xs uppercase tracking-wide text-brand hover:bg-paper"
        >
          {expanded ? 'Ver menos' : `Ver los ${sorted.length - initialLimit} restantes`}
        </button>
      )}
    </div>
  );
}
