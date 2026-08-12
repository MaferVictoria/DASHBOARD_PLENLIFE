import { NextResponse } from 'next/server';
import { getMetaTotals, getMetaMonthly } from '@/lib/connectors/meta';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const [totals, monthly] = await Promise.all([
      getMetaTotals(start, end),
      getMetaMonthly(),
    ]);

    return NextResponse.json({ range: { start, end }, totals, monthly });
  } catch (err) {
    // Surface the real error instead of silently falling back to fake
    // numbers — a broken credential should be visible, not masked.
    console.error('[api/meta] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener la data de Meta Ads.' },
      { status: 502 }
    );
  }
}
