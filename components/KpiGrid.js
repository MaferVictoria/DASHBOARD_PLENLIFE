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

// Tailwind needs the exact class strings to appear literally somewhere in
// the source to include them in the build — this map is how we "pre-declare"
// every column count bestColumnCount() might return.
const GRID_COLS_CLASS = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

// Finds the largest divisor of `count` that's at most 6 (so cards don't get
// too narrow), so the last row is always full instead of leaving empty
// trailing cells — e.g. 9 cards -> 3 columns (3 rows of 3), not 6 columns
// with 3 empty boxes at the end.
function bestColumnCount(count) {
  for (let cols = 6; cols >= 2; cols--) {
    if (count % cols === 0) return cols;
  }
  return Math.min(count, 4);
}

function buildCard({ label, current, previous, format, invert = false }) {
  const change = computeChange(current, previous);
  const changeText = formatChangeText(change, format);
  const direction = invert ? invertDirection(change?.direction) : change?.direction;
  return { label, value: format(current), changeText, direction };
}

// Guards the divide-by-zero case (no new customers that period) by returning
// null instead of 0 — a $0 average ticket would misleadingly read as "free".
function avgTicket(revenue, count) {
  return count > 0 ? revenue / count : null;
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
      { label: 'Ventas netas', current: shopify.netSales, previous: previousShopify?.netSales, format: formatCurrency },
      { label: 'Clientes nuevos', current: shopify.newCustomers, previous: previousShopify?.newCustomers, format: formatNumber },
      { label: 'Valor de compras (clientes nuevos)', current: shopify.newCustomerRevenue, previous: previousShopify?.newCustomerRevenue, format: formatCurrency },
      {
        label: 'Ticket promedio (clientes nuevos)',
        current: avgTicket(shopify.newCustomerRevenue, shopify.newCustomers),
        previous: previousShopify ? avgTicket(previousShopify.newCustomerRevenue, previousShopify.newCustomers) : undefined,
        format: formatCurrency,
      },
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
  // Match the grid to however many cards actually exist so no tab leaves an
  // empty trailing cell — works for both 5-card tabs and the 9-card Resumen.
  const lgColsClass = GRID_COLS_CLASS[bestColumnCount(cards.length)] || 'lg:grid-cols-4';

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
