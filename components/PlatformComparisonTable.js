import { formatCurrency, formatRatio } from '@/lib/format';

// Side-by-side comparison, NOT attribution: what each ad platform reports
// vs. what Shopify itself reports for the same period.
export default function PlatformComparisonTable({ meta, google, shopify }) {
  const rows = [
    {
      platform: 'Meta Ads',
      spend: meta.spend,
      reportedSales: meta.purchaseValue,
      roas: meta.roas,
    },
    {
      platform: 'Google Ads (PMax)',
      spend: google.spend,
      reportedSales: google.conversionValue,
      roas: google.roas,
    },
    {
      platform: 'Shopify (real)',
      spend: null,
      reportedSales: shopify.totalSales,
      roas: null,
    },
  ];

  return (
    <div className="border border-line bg-panel">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="rule-thick border-t-2 border-ink text-left">
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">
              Plataforma
            </th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">
              Gasto
            </th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">
              Ventas reportadas
            </th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">
              ROAS reportado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.platform} className="border-t border-line">
              <td className="px-4 py-2.5 font-medium text-ink">{row.platform}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">
                {row.spend === null ? '—' : formatCurrency(row.spend)}
              </td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">
                {formatCurrency(row.reportedSales)}
              </td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">
                {row.roas === null ? '—' : formatRatio(row.roas)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-2 text-xs text-ink/45">
        Nota: esto compara lo que reporta cada plataforma contra las ventas reales de Shopify — no es
        atribución transaccional (no asume qué venta vino de qué canal).
      </p>
    </div>
  );
}
