import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

// Replaces top-cities/top-products on the Shopify tab (those already live on
// Resumen General) with a customer-composition view: how many are new vs.
// recurring, and what a new customer's first order is worth on average.
export default function CustomerBreakdown({ shopify }) {
  const total = shopify.newCustomers + shopify.returningCustomers;
  const newPct = total > 0 ? shopify.newCustomers / total : 0;
  const returningPct = total > 0 ? shopify.returningCustomers / total : 0;
  const avgTicketNew = shopify.newCustomers > 0 ? shopify.newCustomerRevenue / shopify.newCustomers : 0;

  const stats = [
    { label: 'Total de clientes', value: formatNumber(total), sublabel: '\u00A0' },
    { label: 'Clientes nuevos', value: formatNumber(shopify.newCustomers), sublabel: `${formatPercent(newPct)} del total` },
    { label: 'Clientes recurrentes', value: formatNumber(shopify.returningCustomers), sublabel: `${formatPercent(returningPct)} del total` },
    { label: 'Ticket promedio (nuevos)', value: formatCurrency(avgTicketNew), sublabel: '\u00A0' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col bg-panel px-4 py-3">
            <div className="rule-thick border-t-2 border-ink pt-1.5">
              <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{s.label}</p>
            </div>
            <p className="mt-2 font-body text-2xl font-semibold tabular-nums text-ink sm:text-[28px]">{s.value}</p>
            <div className="rule-thin mt-2 border-t pt-1">
              <p className="font-body text-[10px] text-ink/45">{s.sublabel}</p>
            </div>
          </div>
        ))}
      </div>
      {shopify.unknownCustomerOrders > 0 && (
        <p className="mt-2 font-body text-xs text-ink/45">
          {formatNumber(shopify.unknownCustomerOrders)} pedido(s) de este periodo no traían datos de cliente
          utilizables y se excluyeron de este desglose (no se cuentan como nuevos ni como recurrentes).
        </p>
      )}
    </>
  );
}
