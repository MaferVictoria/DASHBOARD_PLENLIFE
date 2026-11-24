import { NextResponse } from 'next/server';
import { getMetaCreativeLibrary } from '@/lib/connectors/meta';

const AUDIENCES = ['all', 'Prospecting', 'Retargeting', 'Sin clasificar'];

// Filtro por audiencia, orden y top 20 se resuelven en el servidor (ver el
// comentario en lib/connectors/meta.js) para que `total` sea el conteo real
// de anuncios que cumplen el filtro, no solo los que alcanzan a mostrarse.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Missing start/end query params' }, { status: 400 });
  }

  const audienceParam = searchParams.get('audience');
  const audience = AUDIENCES.includes(audienceParam) ? audienceParam : 'all';
  const sort = searchParams.get('sort') || 'roas'; // se valida contra la lista blanca en el conector
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  try {
    const { creatives, total } = await getMetaCreativeLibrary(start, end, { audience, sort, dir, limit: 20 });
    return NextResponse.json({ range: { start, end }, creatives, total });
  } catch (err) {
    console.error('[api/meta/creatives] error:', err);
    return NextResponse.json(
      { error: err.message || 'No se pudo obtener la data de creativos de Meta Ads.' },
      { status: 502 }
    );
  }
}
