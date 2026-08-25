import { formatCurrency, formatNumber, formatPercent, formatChangeText } from '@/lib/format';
import { computeChange } from '@/lib/metrics';

// Adquisición vs. Retención, side by side. Adquisición gets a distinct
// brand-blue tint (per the change doc) so it reads as a separate zone from
// Retención at a glance. Every stat shows % vs. periodo anterior — this
// table always shows the comparison, never just a static snapshot.
function avgTicket(revenue, count) {
  return count > 0 ? revenue / count : null;
}

function StatRow({ label, current, previous, format }) {
  const change = computeChange(current, previous);
  const changeText = formatChangeText(change, format);
  const colorClass = change?.direction === 'up' ? 'text-rise' : change?.direction === 'down' ? 'text-fall' : 'text-ink/40';
  return (
    <div className="border-t border-line pt-2 first:border-t-0 first:pt-0">
      <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      <p className="font-body text-xl font-semibold tabular-nums text-ink">{format(current)}</p>
      <p className={`mt-0.5 font-body text-[10px] ${colorClass}`}>{changeText}</p>
    </div>
  );
}

export default function UserBehaviorPanel({ shopify, blended, previousShopify, previousBlended }) {
  const ticketNuevos = avgTicket(shopify.newCustomerRevenue, shopify.newCustomers);
  const prevTicketNuevos = previousShopify ? avgTicket(previousShopify.newCustomerRevenue, previousShopify.newCustomers) : undefined;

  const ticketRecurrentes = avgTicket(shopify.returningCustomerRevenue, shopify.returningCustomers);
  const prevTicketRecurrentes = previousShopify
    ? avgTicket(previousShopify.returningCustomerRevenue, previousShopify.returningCustomers)
    : undefined;

  const totalCustomers = shopify.newCustomers + shopify.returningCustomers;
  const repeatRate = totalCustomers > 0 ? shopify.returningCustomers / totalCustomers : 0;
  const prevTotalCustomers = previousShopify ? previousShopify.newCustomers + previousShopify.returningCustomers : 0;
  const prevRepeatRate =
    previousShopify && prevTotalCustomers > 0 ? previousShopify.returningCustomers / prevTotalCustomers : undefined;

  return (
    <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
      {/* Adquisición: tinted background + left accent bar to visually separate it from Retención */}
      <div className="border-l-4 border-brand bg-brand/5 p-4">
        <p className="mb-3 font-body text-[10px] uppercase tracking-[0.14em] text-brand">Adquisición</p>
        <div className="space-y-3">
          <StatRow label="Clientes nuevos" current={shopify.newCustomers} previous={previousShopify?.newCustomers} format={formatNumber} />
          <StatRow label="CAC blended" current={blended.blendedCac} previous={previousBlended?.blendedCac} format={formatCurrency} />
          <StatRow label="Ticket promedio (nuevos)" current={ticketNuevos} previous={prevTicketNuevos} format={formatCurrency} />
        </div>
      </div>
      <div className="bg-panel p-4">
        <p className="mb-3 font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">Retención</p>
        <div className="space-y-3">
          <StatRow
            label="Clientes recurrentes"
            current={shopify.returningCustomers}
            previous={previousShopify?.returningCustomers}
            format={formatNumber}
          />
          <StatRow label="% de recompra" current={repeatRate} previous={prevRepeatRate} format={formatPercent} />
          <StatRow
            label="Ticket promedio (recurrentes)"
            current={ticketRecurrentes}
            previous={prevTicketRecurrentes}
            format={formatCurrency}
          />
        </div>
      </div>
    </div>
  );
}
