import { NextResponse } from 'next/server';
import {
  getShopifyTotals,
  getShopifyMonthly,
  getShopifyTopCitiesByMonth,
  getShopifyTopProductsByMonth,
  getShopifyFunnel,
} from '@/lib/connectors/shopify';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  // Set by the "previous period" comparison fetch — skips monthly/top
  // cities/top products/funnel, which are either range-independent or not
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
        topCitiesByMonth: [],
        topProductsByMonth: [],
        funnel: null,
      });
    }

    const [monthly, topCitiesByMonth, topProductsByMonth, funnel] = await Promise.all([
      getShopifyMonthly(),
      getShopifyTopCitiesByMonth(),
      getShopifyTopProductsByMonth(),
      getShopifyFunnel(start, end),
    ]);

    return NextResponse.json({
      range: { start, end },
      totals,
      monthly,
      topCitiesByMonth,
      topProductsByMonth,
      funnel,
    });
  } catch (err) {
    console.error('[api/shopify] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener la data de Shopify.' },
      { status: 502 }
    );
  }
}
