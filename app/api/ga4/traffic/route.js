import { NextResponse } from 'next/server';
import { getChannelBreakdown, getUtmBreakdown } from '@/lib/connectors/ga4';

const UTM_DIMENSIONS = {
  sourceMedium: 'sessionSourceMedium',
  campaign: 'sessionCampaignName',
  source: 'sessionSource',
  adContent: 'sessionManualAdContent',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  // Each of the 4 UTM tables is fetched independently and isolated with its
  // own try/catch — if one dimension name ever turns out wrong, the other 3
  // tables (and the channel donut) should still work rather than the whole
  // route failing.
  async function safeUtm(dimension) {
    try {
      return { data: await getUtmBreakdown(start, end, dimension), error: null };
    } catch (err) {
      console.error(`[api/ga4/traffic] ${dimension} failed:`, err.message);
      return { data: [], error: err.message };
    }
  }

  try {
    const [channel, sourceMedium, campaign, source, adContent] = await Promise.all([
      getChannelBreakdown(start, end).catch((err) => {
        console.error('[api/ga4/traffic] channel breakdown failed:', err.message);
        return { donut: [], sourceTable: [], error: err.message };
      }),
      safeUtm(UTM_DIMENSIONS.sourceMedium),
      safeUtm(UTM_DIMENSIONS.campaign),
      safeUtm(UTM_DIMENSIONS.source),
      safeUtm(UTM_DIMENSIONS.adContent),
    ]);

    return NextResponse.json({
      range: { start, end },
      channel,
      utm: {
        sourceMedium: sourceMedium.data,
        sourceMediumError: sourceMedium.error,
        campaign: campaign.data,
        campaignError: campaign.error,
        source: source.data,
        sourceError: source.error,
        adContent: adContent.data,
        adContentError: adContent.error,
      },
    });
  } catch (err) {
    console.error('[api/ga4/traffic] error:', err);
    return NextResponse.json({ error: err.message || 'No se pudo obtener la data de GA4.' }, { status: 502 });
  }
}
