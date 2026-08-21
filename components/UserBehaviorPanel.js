import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

// Adquisición vs. Retención, side by side. "Costo por visita" is
// deliberately shown as unavailable rather than approximated — Plenlife
// doesn't have a real site-wide "visitas" number yet (that needs GA4 or
// Shopify's own site analytics; see the funnel caveats in
// lib/connectors/shopify.js), and mixing blended ad spend with a
// Meta-only visits count would produce a misleading number, not a
// conservative estimate.
export default function UserBehaviorPanel({ shopify, blended }) {
  const returningRevenue = shopify.returningCustomerRevenue || 0;
  const avgTicketReturning = shopify.returningCustomers > 0 ? returningRevenue / shopify.returningCustomers : 0;
  const totalCustomers = shopify.newCustomers + shopify.returningCustomers;
  const repeatRate = totalCustomers > 0 ? shopify.returningCustomers / totalCustomers : 0;

  const acquisition = [
    { label: 'Clientes nuevos', value: formatNumber(shopify.newCustomers) },
    { label: 'CAC blended', value: formatCurrency(blended.blendedCac) },
    { label: 'Costo por visita', value: '—', note: 'No disponible (requiere datos de visitas al sitio)' },
  ];

  const retention = [
    { label: 'Clientes recurrentes', value: formatNumber(shopify.returningCustomers) },
    { label: '% de recompra', value: formatPercent(repeatRate) },
    { label: 'Ticket promedio (recurrentes)', value: formatCurrency(avgTicketReturning) },
  ];

  return (
    <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
      <div className="bg-panel p-4">
        <p className="mb-3 font-body text-[10px] uppercase tracking-[0.14em] text-brand">Adquisición</p>
        <div className="space-y-3">
          {acquisition.map((item) => (
            <div key={item.label} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{item.label}</p>
              <p className="font-body text-xl font-semibold tabular-nums text-ink">{item.value}</p>
              {item.note && <p className="mt-0.5 font-body text-[10px] text-ink/40">{item.note}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-panel p-4">
        <p className="mb-3 font-body text-[10px] uppercase tracking-[0.14em] text-brand">Retención</p>
        <div className="space-y-3">
          {retention.map((item) => (
            <div key={item.label} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{item.label}</p>
              <p className="font-body text-xl font-semibold tabular-nums text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
