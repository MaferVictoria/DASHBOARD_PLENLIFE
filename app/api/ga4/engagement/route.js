import { NextResponse } from 'next/server';
import { getEngagementKpis, getMonthlyVisitorsSessions, getMonthlyRates, getFunnelSteps, getMonthlyDetailTable } from '@/lib/connectors/ga4';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  // Set by the "previous period" comparison fetch — only needs the KPI
  // totals, skips the (range-independent) monthly charts/table/funnel.
  const totalsOnly = searchParams.get('totalsOnly') === '1';

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const kpis = await getEngagementKpis(start, end);

    if (totalsOnly) {
      return NextResponse.json({ range: { start, end }, kpis });
    }

    const [monthlyVisitorsSessions, monthlyRates, funnel, monthlyDetail] = await Promise.all([
      getMonthlyVisitorsSessions(),
      getMonthlyRates(),
      getFunnelSteps(start, end),
      getMonthlyDetailTable(),
    ]);

    return NextResponse.json({
      range: { start, end },
      kpis,
      monthlyVisitorsSessions,
      monthlyRates,
      funnel,
      monthlyDetail,
    });
  } catch (err) {
    console.error('[api/ga4/engagement] error:', err);
    return NextResponse.json({ error: err.message || 'No se pudo obtener la data de GA4.' }, { status: 502 });
  }
}
