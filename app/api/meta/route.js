import { NextResponse } from 'next/server';
import { getMetaTotals, getMetaMonthly } from '@/lib/connectors/meta';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  const [totals, monthly] = await Promise.all([
    getMetaTotals(start, end),
    getMetaMonthly(),
  ]);

  return NextResponse.json({ range: { start, end }, totals, monthly });
}
