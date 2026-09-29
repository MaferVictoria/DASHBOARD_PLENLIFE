import { NextResponse } from 'next/server';
import { getMetaGeoBreakdown, getMetaDemographicsBreakdown } from '@/lib/connectors/meta';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const [geo, demographics] = await Promise.all([
      getMetaGeoBreakdown(start, end),
      getMetaDemographicsBreakdown(start, end),
    ]);
    return NextResponse.json({ range: { start, end }, geo, demographics });
  } catch (err) {
    console.error('[api/meta/breakdowns] error:', err);
    return NextResponse.json({ error: err.message || 'No se pudo obtener el desglose de Meta Ads.' }, { status: 502 });
  }
}
