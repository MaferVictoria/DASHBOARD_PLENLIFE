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

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  const [totals, monthly, topCitiesByMonth, topProductsByMonth, funnel] =
    await Promise.all([
      getShopifyTotals(start, end),
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
}
