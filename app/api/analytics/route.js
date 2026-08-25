import { NextResponse } from 'next/server';
import { getSiteFunnelTopSteps } from '@/lib/connectors/ga4';

// Used by Resumen Ejecutivo's "Visitas → Compras" funnel — just the top 2
// steps (real sessions + add_to_cart from GA4). The full Tráfico
// Web/Engagement Web tabs use /api/ga4/traffic and /api/ga4/engagement
// instead, which need many more report types.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const funnel = await getSiteFunnelTopSteps(start, end);
    return NextResponse.json({ range: { start, end }, funnel });
  } catch (err) {
    console.error('[api/analytics] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener la data de Google Analytics.' },
      { status: 502 }
    );
  }
}
