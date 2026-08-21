import { NextResponse } from 'next/server';
import { getGoogleTotals, getGoogleMonthly, getGoogleFunnel } from '@/lib/connectors/googleAds';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const totalsOnly = searchParams.get('totalsOnly') === '1';

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const totals = await getGoogleTotals(start, end);

    if (totalsOnly) {
      return NextResponse.json({ range: { start, end }, totals, monthly: [], funnel: null });
    }

    const [monthly, funnel] = await Promise.all([getGoogleMonthly(), getGoogleFunnel(start, end)]);
    return NextResponse.json({ range: { start, end }, totals, monthly, funnel });
  } catch (err) {
    console.error('[api/google] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener la data de Google Ads.' },
      { status: 502 }
    );
  }
}
