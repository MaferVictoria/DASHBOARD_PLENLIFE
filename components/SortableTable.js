'use client';

import { useState, useMemo } from 'react';
import { formatNumber, formatPercent, formatDuration } from '@/lib/format';

const COLUMNS = [
  { key: 'key', label: null, format: (v) => v },
  { key: 'visitantes', label: 'Visitantes', format: formatNumber },
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
export default function SortableTable({ data, keyLabel = 'Valor', error }) {
  const [sortKey, setSortKey] = useState('sesiones');
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
    <div className="overflow-x-auto border border-line bg-panel">
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
          {sorted.map((row, i) => (
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
  );
}
