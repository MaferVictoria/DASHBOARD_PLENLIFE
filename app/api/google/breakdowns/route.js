import { NextResponse } from 'next/server';
import { getGoogleGeoBreakdown } from '@/lib/connectors/googleAds';

// byAge/byGender removed (29 sep 2026) — Google Ads' age_range_view/
// gender_view are built on ad_group_criterion, and Performance Max
// campaigns don't have ad groups (they use asset groups instead).
// Confirmed by Google's own API support team: these views structurally
// cannot report on PMax campaigns, so querying them here would just waste
// API quota for a result that's always empty on this account.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const [byRegion, byCity] = await Promise.all([
      getGoogleGeoBreakdown(start, end, 'region'),
      getGoogleGeoBreakdown(start, end, 'city'),
    ]);
    return NextResponse.json({ range: { start, end }, byRegion, byCity });
  } catch (err) {
    console.error('[api/google/breakdowns] error:', err);
    return NextResponse.json({ error: err.message || 'No se pudo obtener el desglose de Google Ads.' }, { status: 502 });
  }
}
