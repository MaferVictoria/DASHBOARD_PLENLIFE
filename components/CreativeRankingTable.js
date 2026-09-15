'use client';

import { useState, useMemo } from 'react';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

// Top 3-5 ads by ROAS, with thumbnails. Meta-only — Google PMax doesn't
// expose per-creative thumbnails the same straightforward way. Thumbnails
// come straight from Meta's CDN (signed URLs), so this uses a plain <img>
// instead of next/image (which would need every possible fbcdn.net
// subdomain pre-registered in next.config.js).
//
// Wide table — scrolls horizontally on narrow screens rather than wrapping/
// shrinking illegibly.
function formatFrequency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

function formatCtr(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

// Every column except Miniatura is sortable — click a header to sort by it
// (defaults to descending on a new column), click the same header again to
// flip direction. Same "⇅ on every column, ▲/▼ on the active one" indicator
// convention as SortableTable.js, so this reads consistently with the rest
// of the dashboard's tables.
const SORTABLE_COLUMNS = [
  { key: 'adName', label: 'Concepto' },
  { key: 'spend', label: 'Inversión' },
  { key: 'reach', label: 'Alcance' },
  { key: 'impressions', label: 'Impresiones' },
  { key: 'frequency', label: 'Frecuencia' },
  { key: 'uniqueCtr', label: 'CTR único' },
  { key: 'landingPageViews', label: 'Visitas a la web' },
  { key: 'costPerVisit', label: 'Costo por visita' },
  { key: 'purchases', label: 'Compras' },
  { key: 'purchaseValue', label: 'Valor de compras' },
  { key: 'cpa', label: 'Costo por compra' },
  { key: 'roas', label: 'ROAS' },
];

export default function CreativeRankingTable({ creatives }) {
  const [sortKey, setSortKey] = useState('roas');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const copy = [...(creatives || [])];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      // Nulls (e.g. costPerVisit with zero landing page views) sort last
      // regardless of direction, instead of throwing NaN comparisons off.
      const an = av === null || av === undefined ? -Infinity : av;
      const bn = bv === null || bv === undefined ? -Infinity : bv;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return copy;
  }, [creatives, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (!creatives || creatives.length === 0) {
    return (
      <div className="border border-line bg-panel p-6 text-center">
        <p className="font-body text-sm text-ink/50">
          No hay anuncios con gasto en este periodo para armar el ranking.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-line bg-panel">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="rule-thick border-t-2 border-ink text-left">
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Miniatura</th>
            {SORTABLE_COLUMNS.map((col) => {
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
          {sorted.map((c) => (
            <tr key={c.adId} className="border-t border-line">
              <td className="px-4 py-2.5">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnailUrl} alt={c.adName} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-line font-body text-[9px] text-ink/40">
                    Sin imagen
                  </div>
                )}
              </td>
              <td className="max-w-[200px] px-4 py-2.5" title={c.adName}>
                <p className="truncate font-medium text-ink">{c.adName}</p>
                {c.audience && (
                  <span className="mt-0.5 inline-block font-body text-[10px] uppercase tracking-wide text-ink/40">
                    {c.audience}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(c.spend)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(c.reach)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(c.impressions)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatFrequency(c.frequency)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCtr(c.uniqueCtr)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(c.landingPageViews)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(c.costPerVisit)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(c.purchases)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(c.purchaseValue)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(c.cpa)}</td>
              <td className="px-4 py-2.5 font-body font-semibold tabular-nums text-brand">{formatRatio(c.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
