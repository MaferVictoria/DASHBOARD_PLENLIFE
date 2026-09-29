import { NextResponse } from 'next/server';
import { getGoogleGeoBreakdown, getGoogleAgeBreakdown, getGoogleGenderBreakdown } from '@/lib/connectors/googleAds';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const [byRegion, byCity, byAge, byGender] = await Promise.all([
      getGoogleGeoBreakdown(start, end, 'region'),
      getGoogleGeoBreakdown(start, end, 'city'),
      getGoogleAgeBreakdown(start, end),
      getGoogleGenderBreakdown(start, end),
    ]);
    return NextResponse.json({ range: { start, end }, byRegion, byCity, byAge, byGender });
  } catch (err) {
    console.error('[api/google/breakdowns] error:', err);
    return NextResponse.json({ error: err.message || 'No se pudo obtener el desglose de Google Ads.' }, { status: 502 });
  }
}
