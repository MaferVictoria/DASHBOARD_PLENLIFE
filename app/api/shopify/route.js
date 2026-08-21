import { NextResponse } from 'next/server';
import {
  getShopifyTotals,
  getShopifyMonthly,
  getShopifyTopStatesByMonth,
  getShopifyTopProductsByMonth,
  getShopifyNewCustomersMonthly,
  getShopifyAbandonedCheckoutsCount,
} from '@/lib/connectors/shopify';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  // Set by the "previous period" comparison fetch — skips monthly/top
  // states/top products/funnel, which are either range-independent or not
  // needed for a comparison card, and are the expensive part of this route
  // now that it scans real Shopify orders.
  const totalsOnly = searchParams.get('totalsOnly') === '1';

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const totals = await getShopifyTotals(start, end);

    if (totalsOnly) {
      return NextResponse.json({
        range: { start, end },
        totals,
        monthly: [],
        topStatesByMonth: [],
        topProductsByMonth: [],
        newCustomersMonthly: [],
        abandonedCheckoutsCount: null,
        checkoutFunnel: null,
      });
    }

    const [monthly, topStatesByMonth, topProductsByMonth, newCustomersMonthly, abandonedCheckoutsCount] =
      await Promise.all([
        getShopifyMonthly(),
        getShopifyTopStatesByMonth(),
        getShopifyTopProductsByMonth(),
        getShopifyNewCustomersMonthly(),
        getShopifyAbandonedCheckoutsCount(start, end),
      ]);

    const checkoutFunnel = { checkoutsStarted: abandonedCheckoutsCount + totals.orders, purchases: totals.orders };

    return NextResponse.json({
      range: { start, end },
      totals,
      monthly,
      topStatesByMonth,
      topProductsByMonth,
      newCustomersMonthly,
      abandonedCheckoutsCount,
      checkoutFunnel,
    });
  } catch (err) {
    console.error('[api/shopify] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener la data de Shopify.' },
      { status: 502 }
    );
  }
}
