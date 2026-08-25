import { formatCurrency, formatRatio } from '@/lib/format';

// Side-by-side comparison, NOT attribution: what each ad platform reports
// vs. what Shopify itself reports for the same period. Shopify is broken
// into brutas/netas/totales (3 rows) instead of one, and each ad platform
// gets a "% variación" against Shopify's Ventas Netas — how much higher or
// lower the platform's own self-reported sales are vs. what Shopify's real
// net sales actually were for the same period. This is NOT the same as
// attribution error — platforms routinely over/under-report vs. reality for
// reasons unrelated to any one channel being "wrong" (view-through windows,
// cross-device modeling, etc.) — it's a magnitude check, not a verdict.
function variance(platformSales, shopifyNetSales) {
  if (!shopifyNetSales) return null;
  return ((platformSales - shopifyNetSales) / shopifyNetSales) * 100;
}

function VarianceCell({ value }) {
  if (value === null) return <span className="text-ink/40">—</span>;
  const sign = value >= 0 ? '+' : '';
  return (
    <span className="font-semibold">
      {sign}
      {value.toFixed(1)}%
    </span>
  );
}

export default function PlatformComparisonTable({ meta, google, shopify }) {
  const adRows = [
    {
      platform: 'Meta Ads',
      spend: meta.spend,
      reportedSales: meta.purchaseValue,
      roas: meta.roas,
      variance: variance(meta.purchaseValue, shopify.netSales),
    },
    {
      platform: 'Google Ads (PMax)',
      spend: google.spend,
      reportedSales: google.conversionValue,
      roas: google.roas,
      variance: variance(google.conversionValue, shopify.netSales),
    },
  ];

  const shopifyRows = [
    { platform: 'Shopify — Ventas brutas', reportedSales: shopify.grossSales },
    { platform: 'Shopify — Ventas netas', reportedSales: shopify.netSales },
    { platform: 'Shopify — Ventas totales', reportedSales: shopify.totalSales },
  ];

  return (
    <div className="border border-line bg-panel">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="rule-thick border-t-2 border-ink text-left">
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Plataforma</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">Gasto</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">
              Ventas reportadas
            </th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">ROAS reportado</th>
            <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wide text-ink/60">
              % var. vs. Shopify (netas)
            </th>
          </tr>
        </thead>
        <tbody>
          {adRows.map((row) => (
            <tr key={row.platform} className="border-t border-line">
              <td className="px-4 py-2.5 font-medium text-ink">{row.platform}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatCurrency(row.spend)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">
                {formatCurrency(row.reportedSales)}
              </td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">{formatRatio(row.roas)}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink">
                <VarianceCell value={row.variance} />
              </td>
            </tr>
          ))}
          {shopifyRows.map((row) => (
            <tr key={row.platform} className="border-t border-line bg-paper/50">
              <td className="px-4 py-2.5 text-ink/70">{row.platform}</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/40">—</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/80">
                {formatCurrency(row.reportedSales)}
              </td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/40">—</td>
              <td className="px-4 py-2.5 font-body tabular-nums text-ink/40">—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-2 text-xs text-ink/45">
        Nota: esto compara lo que reporta cada plataforma contra las ventas reales de Shopify — no es
        atribución transaccional (no asume qué venta vino de qué canal). "% var." se calcula contra Ventas
        Netas de Shopify.
      </p>
    </div>
  );
}
