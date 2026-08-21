import { NextResponse } from 'next/server';
import { getMetaTopCreatives } from '@/lib/connectors/meta';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  try {
    const creatives = await getMetaTopCreatives(start, end, 5);
    return NextResponse.json({ range: { start, end }, creatives });
  } catch (err) {
    console.error('[api/meta/creatives] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener el ranking de creativos de Meta.' },
      { status: 502 }
    );
  }
}
