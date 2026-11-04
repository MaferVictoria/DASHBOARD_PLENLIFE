import { NextResponse } from 'next/server';
import { getMetaCreativesPage } from '@/lib/connectors/meta';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const start = params.get('start');
  const end = params.get('end');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '') || start > end) {
    return NextResponse.json({ error: 'Selecciona un rango de fechas válido.' }, { status: 400 });
  }
  try {
    const result = await getMetaCreativesPage(start, end, {
      page: params.get('page'), audience: params.get('audience') || 'all', sort: params.get('sort') || 'roas',
      direction: params.get('direction') || 'desc', query: (params.get('q') || '').slice(0, 100),
    });
    return NextResponse.json({ range: { start, end }, ...result });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el listado completo de Meta. Revisa la conexión y vuelve a intentarlo.' }, { status: 502 });
  }
}
