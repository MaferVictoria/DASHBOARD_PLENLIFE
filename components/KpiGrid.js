import KpiCard from './KpiCard';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

// Chooses which KPI cards to render depending on the active tab.
// platform: 'all' | 'meta' | 'google' | 'shopify'
export default function KpiGrid({ platform, meta, google, shopify, blended }) {
  let cards = [];

  if (platform === 'all') {
    cards = [
      { label: 'Gasto total (Meta + Google)', value: formatCurrency(blended.totalSpend) },
      { label: 'Ventas totales (Shopify)', value: formatCurrency(shopify.totalSales) },
      { label: 'MER', value: formatRatio(blended.mer) },
      { label: 'ROAS blended', value: formatRatio(blended.blendedRoas) },
      { label: 'CAC blended', value: formatCurrency(blended.blendedCac) },
      { label: 'Pedidos totales', value: formatNumber(shopify.orders) },
    ];
  } else if (platform === 'meta') {
    cards = [
      { label: 'Gasto', value: formatCurrency(meta.spend) },
      { label: 'Compras', value: formatNumber(meta.purchases) },
      { label: 'Valor de compras', value: formatCurrency(meta.purchaseValue) },
      { label: 'ROAS', value: formatRatio(meta.roas) },
      { label: 'CPA', value: formatCurrency(meta.cpa) },
    ];
  } else if (platform === 'google') {
    cards = [
      { label: 'Gasto', value: formatCurrency(google.spend) },
      { label: 'Conversiones', value: formatNumber(google.conversions) },
      { label: 'Valor de conversión', value: formatCurrency(google.conversionValue) },
      { label: 'ROAS', value: formatRatio(google.roas) },
      { label: 'CPA', value: formatCurrency(google.cpa) },
    ];
  } else if (platform === 'shopify') {
    cards = [
      { label: 'Ventas totales', value: formatCurrency(shopify.totalSales) },
      { label: 'Ventas netas', value: formatCurrency(shopify.netSales) },
      { label: 'Pedidos', value: formatNumber(shopify.orders) },
      { label: 'Clientes nuevos', value: formatNumber(shopify.newCustomers) },
      { label: 'Clientes recurrentes', value: formatNumber(shopify.returningCustomers) },
    ];
  }

  return (
    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <KpiCard key={card.label} label={card.label} value={card.value} />
      ))}
    </div>
  );
}
