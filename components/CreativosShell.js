'use client';

import { useEffect, useState } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import CreativeRankingTable from './CreativeRankingTable';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';

export default function CreativosShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [creatives, setCreatives] = useState([]);
  const [errors, setErrors] = useState({ meta: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJSON(`/api/meta/creatives?start=${range.start}&end=${range.end}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setErrors({ meta: res.error });
          setCreatives([]);
        } else {
          setErrors({ meta: null });
          setCreatives(res.creatives || []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Biblioteca de Creativos</h1>
            <p className="mt-1 text-sm text-ink/60">Rendimiento visual y financiero de los anuncios de Meta.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ErrorBanner errors={errors} />

        <SectionHeader
          eyebrow="Ranking"
          title="Top creativos por ROAS"
          note={`${range.start} → ${range.end}`}
        />
        <CreativeRankingTable creatives={creatives} />
      </main>
    </div>
  );
}
