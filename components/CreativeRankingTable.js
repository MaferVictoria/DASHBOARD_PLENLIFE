import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

// Top 3-5 ads by ROAS, with thumbnails. Meta-only — Google PMax doesn't
// expose per-creative thumbnails the same straightforward way. Thumbnails
// come straight from Meta's CDN (signed URLs), so this uses a plain <img>
// instead of next/image (which would need every possible fbcdn.net
// subdomain pre-registered in next.config.js).
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
    <div className="border border-line bg-panel">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="rule-thick border-t-2 border-ink text-left">
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Miniatura</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Concepto</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Inversión</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Clics</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">CPA</th>
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
              <td className="max-w-[220px] px-4 py-2.5" title={c.adName}>
                <p className="truncate font-medium text-ink">{c.adName}</p>
                {c.audience && (
                  <span className="mt-0.5 inline-block font-body text-[10px] uppercase tracking-wide text-ink/40">
                    {c.audience}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(c.spend)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatNumber(c.clicks)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(c.cpa)}</td>
              <td className="px-4 py-2.5 font-body font-semibold tabular-nums text-brand">{formatRatio(c.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
