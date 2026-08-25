import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

// Top 3-5 ads by ROAS, with thumbnails. Meta-only — Google PMax doesn't
// expose per-creative thumbnails the same straightforward way. Thumbnails
// come straight from Meta's CDN (signed URLs), so this uses a plain <img>
// instead of next/image (which would need every possible fbcdn.net
// subdomain pre-registered in next.config.js).
//
// Columns per the Aug 2026 change doc: Inversión, Alcance, Impresiones,
// Frecuencia, CTR único, Visitas a la página web, Costo por visita, Compras,
// Valor de Compras, Costo por compra, ROAS. Wide table — scrolls
// horizontally on narrow screens rather than wrapping/shrinking illegibly.
function formatFrequency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

function formatCtr(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

export default function CreativeRankingTable({ creatives }) {
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
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Concepto</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Inversión</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Alcance</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Impresiones</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Frecuencia</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">CTR único</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Visitas a la web</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Costo por visita</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Compras</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Valor de compras</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Costo por compra</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {creatives.map((c) => (
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
