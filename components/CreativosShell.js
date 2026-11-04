'use client';

import { useEffect, useState } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import CreativeCards from './CreativeCards';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';

const AUDIENCE_FILTERS = [
  { id: 'all', label: 'Todos' }, { id: 'Prospecting', label: 'Prospecting' },
  { id: 'Retargeting', label: 'Retargeting' }, { id: 'Sin clasificar', label: 'Sin clasificar' },
];
const SORT_OPTIONS = [
  ['roas','ROAS'], ['adName','Nombre'], ['spend','Inversión'], ['reach','Alcance'],
  ['uniqueCtr','CTR único'], ['landingPageViews','Visitas a la página'], ['addToCart','Añadidos al carrito'],
  ['cartValue','Valor carrito'], ['initiateCheckout','Inicios de checkout'], ['purchases','Compras'],
  ['purchaseValue','Valor de compra'], ['impressions','Impresiones'], ['frequency','Frecuencia'],
  ['costPerVisit','Costo por visita'], ['cpa','Costo por compra'],
];
export default function CreativosShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState({ creatives: [], total: 0, page: 1, pages: 1, pageSize: 20 });
  const [errors, setErrors] = useState({ meta: null });
  const [audience, setAudience] = useState('all');
  const [sort, setSort] = useState('roas');
  const [direction, setDirection] = useState('desc');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { const timer = setTimeout(() => { setPage(1); setQuery(search); }, 350); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [range.start, range.end]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ start: range.start, end: range.end, audience, sort, direction, page: String(page), q: query });
    fetchJSON(`/api/meta/creatives?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setErrors({ meta: res.error }); setResult({ creatives: [], total: 0, page: 1, pages: 1, pageSize: 20 }); }
        else { setErrors({ meta: null }); setResult(res); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.start, range.end, audience, sort, direction, page, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Biblioteca de Creativos</h1>
            <p className="mt-1 text-sm text-ink/60">Rendimiento visual y financiero de los anuncios de Meta.</p></div>
          <DateRangeSelector />
        </div>
      </header>
      <main>
        <ErrorBanner errors={errors} />
        <SectionHeader eyebrow="Ranking" title="Creativos de Meta" note={`${range.start} → ${range.end}`} />
        <div className="creative-toolbar">
          <label>Buscar anuncio o campaña<input type="search" value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" /></label>
          <label>Ordenar por<select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Dirección<select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}>
            <option value="desc">Mayor a menor</option><option value="asc">Menor a mayor</option>
          </select></label>
        </div>
        <div className="creative-filters" role="group" aria-label="Filtrar por audiencia">
          {AUDIENCE_FILTERS.map((f) => <button type="button" key={f.id} aria-pressed={audience === f.id}
            onClick={() => { setAudience(f.id); setPage(1); }}>{f.label}</button>)}
        </div>
        <p className="creative-note">Audiencia estimada por el nombre del anuncio: «RTG» o «PRO»; no verifica la segmentación real.</p>
        <p className="creative-note">Compras, valor y eventos atribuidos por Meta; no son pedidos de Shopify. Moneda: MXN. «—» indica dato no disponible.</p>
        {result.source === 'demo' && <p className="creative-demo" role="status">Datos de ejemplo: Meta no está configurado. No son resultados reales.</p>}
        {loading ? <p className="creative-status" role="status">Cargando anuncios…</p> : !errors.meta && <>
          <p className="creative-status" aria-live="polite">Mostrando {result.creatives.length} de {result.total} anuncios</p>
          <CreativeCards creatives={result.creatives} page={result.page} pageSize={result.pageSize} />
          {result.pages > 1 && <nav className="creative-pagination" aria-label="Páginas de anuncios">
            <button type="button" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>Anterior</button>
            <span>Página {result.page} de {result.pages}</span>
            <button type="button" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)}>Siguiente</button>
          </nav>}
        </>}
      </main>
    </div>
  );
}
