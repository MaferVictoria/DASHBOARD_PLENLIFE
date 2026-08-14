import { NextResponse } from 'next/server';
import { getMetaTotals, getMetaMonthly, getMetaFunnel } from '@/lib/connectors/meta';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  // Set by the "previous period" comparison fetch — skips the monthly
  // breakdown and funnel (extra Meta API calls) since neither is needed there.
  const totalsOnly = searchParams.get('totalsOnly') === '1';

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const totals = await getMetaTotals(start, end);

    if (totalsOnly) {
      return NextResponse.json({ range: { start, end }, totals, monthly: [], funnel: null });
    }

    const [monthly, funnel] = await Promise.all([getMetaMonthly(), getMetaFunnel(start, end)]);
    return NextResponse.json({ range: { start, end }, totals, monthly, funnel });
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
