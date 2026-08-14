import KpiCard from './KpiCard';
import { formatCurrency, formatNumber, formatRatio, formatChangeText } from '@/lib/format';
import { computeChange } from '@/lib/metrics';

// For cost metrics (CPA, CAC) an increase is bad and a decrease is good —
// the opposite of revenue/volume metrics — so we flip the color, not the math.
function invertDirection(direction) {
  if (direction === 'up') return 'down';
  if (direction === 'down') return 'up';
  return direction;
}

function buildCard({ label, current, previous, format, invert = false }) {
  const change = computeChange(current, previous);
  const changeText = formatChangeText(change, format);
  const direction = invert ? invertDirection(change?.direction) : change?.direction;
  return { label, value: format(current), changeText, direction };
}

// Chooses which KPI cards to render depending on the active tab, and pairs
// each one with its equivalent from the previous period for the % / absolute
// change line. `previousX` props are null when there's no previous period
// available (e.g. "Todo el histórico" or a failed comparison fetch) —
// buildCard()/computeChange() already handle that as "no comparison" rather
// than showing a misleading 0%.
export default function KpiGrid({
  platform,
  meta,
  google,
  shopify,
  blended,
  previousMeta,
  previousGoogle,
  previousShopify,
  previousBlended,
}) {
  let defs = [];

  if (platform === 'all') {
    defs = [
      { label: 'Gasto total (Meta + Google)', current: blended.totalSpend, previous: previousBlended?.totalSpend, format: formatCurrency },
      { label: 'Ventas totales (Shopify)', current: shopify.totalSales, previous: previousShopify?.totalSales, format: formatCurrency },
      { label: 'MER', current: blended.mer, previous: previousBlended?.mer, format: formatRatio },
      { label: 'ROAS blended', current: blended.blendedRoas, previous: previousBlended?.blendedRoas, format: formatRatio },
      { label: 'CAC blended', current: blended.blendedCac, previous: previousBlended?.blendedCac, format: formatCurrency, invert: true },
      { label: 'Pedidos totales', current: shopify.orders, previous: previousShopify?.orders, format: formatNumber },
    ];
  } else if (platform === 'meta') {
    defs = [
      { label: 'Gasto', current: meta.spend, previous: previousMeta?.spend, format: formatCurrency },
      { label: 'Compras', current: meta.purchases, previous: previousMeta?.purchases, format: formatNumber },
      { label: 'Valor de compras', current: meta.purchaseValue, previous: previousMeta?.purchaseValue, format: formatCurrency },
      { label: 'ROAS', current: meta.roas, previous: previousMeta?.roas, format: formatRatio },
      { label: 'CPA', current: meta.cpa, previous: previousMeta?.cpa, format: formatCurrency, invert: true },
    ];
  } else if (platform === 'google') {
    defs = [
      { label: 'Gasto', current: google.spend, previous: previousGoogle?.spend, format: formatCurrency },
      { label: 'Conversiones', current: google.conversions, previous: previousGoogle?.conversions, format: formatNumber },
      { label: 'Valor de conversión', current: google.conversionValue, previous: previousGoogle?.conversionValue, format: formatCurrency },
      { label: 'ROAS', current: google.roas, previous: previousGoogle?.roas, format: formatRatio },
      { label: 'CPA', current: google.cpa, previous: previousGoogle?.cpa, format: formatCurrency, invert: true },
    ];
  } else if (platform === 'shopify') {
    defs = [
      { label: 'Ventas totales', current: shopify.totalSales, previous: previousShopify?.totalSales, format: formatCurrency },
      { label: 'Ventas netas', current: shopify.netSales, previous: previousShopify?.netSales, format: formatCurrency },
      { label: 'Pedidos', current: shopify.orders, previous: previousShopify?.orders, format: formatNumber },
      { label: 'Clientes nuevos', current: shopify.newCustomers, previous: previousShopify?.newCustomers, format: formatNumber },
      { label: 'Clientes recurrentes', current: shopify.returningCustomers, previous: previousShopify?.returningCustomers, format: formatNumber },
    ];
  }

  const cards = defs.map(buildCard);
  // Match the grid to however many cards actually exist instead of a fixed
  // 6, so a 5-card tab (Meta/Google/Shopify) doesn't leave an empty cell.
  const lgColsClass = cards.length >= 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5';

  return (
    <div className={`grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 ${lgColsClass}`}>
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          changeText={card.changeText}
          direction={card.direction}
        />
      ))}
    </div>
  );
}
