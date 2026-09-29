'use client';

import { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

const DONUT_COLORS = ['#086eb6', '#8B5CF6', '#009dde', '#E8A33D', '#1F7A5C', '#94A3B8'];

// The 4 metrics the person can toggle between, where the underlying data
// supports it. `visits` means different things per platform (Meta: real
// landing_page_view pixel events; Google: ad clicks, the closest available
// proxy — see connector comments) but is presented uniformly here.
const METRIC_OPTIONS = [
  { key: 'spend', label: 'Inversión', format: formatCurrency },
  { key: 'visits', label: 'Visitas a la landing', format: formatNumber },
  { key: 'purchases', label: 'Compras', format: formatNumber },
  { key: 'roas', label: 'ROAS', format: formatRatio },
];

// Top 5 by the selected metric, everything else collapsed into "Otros".
// ROAS needs special handling: averaging individual ROAS values for the
// "Otros" bucket would be mathematically wrong (a ratio of ratios) — it's
// recomputed as (sum of revenue for the rest) / (sum of spend for the rest).
function buildTopFiveWithOthers(data, metricKey) {
  const sorted = [...(data || [])].sort((a, b) => b[metricKey] - a[metricKey]);
  const top5 = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  const slices = top5.map((d) => ({ label: d.label, value: d[metricKey] }));

  if (rest.length > 0) {
    let othersValue;
    if (metricKey === 'roas') {
      const restSpend = rest.reduce((s, d) => s + d.spend, 0);
      const restRevenue = rest.reduce((s, d) => s + d.revenue, 0);
      othersValue = restSpend > 0 ? restRevenue / restSpend : 0;
    } else {
      othersValue = rest.reduce((s, d) => s + d[metricKey], 0);
    }
    slices.push({ label: 'Otros', value: othersValue });
  }

  return slices;
}

// Meta brings age+gender back COMBINED in one response — these re-aggregate
// that same response into a "por edad" view and a "por género" view, so
// Meta gets 2 separate donuts like Google, without a second API call.
function aggregateBy(rows, keyField) {
  const totals = {};
  rows.forEach((row) => {
    const key = row[keyField];
    if (!totals[key]) totals[key] = { label: key, spend: 0, visits: 0, purchases: 0, revenue: 0 };
    totals[key].spend += row.spend;
    totals[key].visits += row.visits;
    totals[key].purchases += row.purchases;
    totals[key].revenue += row.revenue;
  });
  return Object.values(totals).map((t) => ({ ...t, roas: t.spend > 0 ? t.revenue / t.spend : 0 }));
}

// One card = one breakdown: the metric toggle (only when the underlying
// data actually has more than spend to show) + the donut + its legend.
// No summary stat row anymore (removed per feedback — just the chart and
// its breakdown, nothing else).
function BreakdownCard({ data, title, note, error, showMetricToggle = true }) {
  const availableOptions = showMetricToggle ? METRIC_OPTIONS : METRIC_OPTIONS.slice(0, 1);
  const [metric, setMetric] = useState(availableOptions[0].key);
  const activeOption = availableOptions.find((m) => m.key === metric) || availableOptions[0];

  const chartData = useMemo(() => buildTopFiveWithOthers(data, metric), [data, metric]);
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{title}</p>
        {note && <p className="mt-0.5 font-body text-[10px] text-ink/40">{note}</p>}
      </div>

      {showMetricToggle && !error && data && data.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMetric(opt.key)}
              className={[
                'rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wide transition-colors',
                metric === opt.key
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-panel text-ink/60 hover:border-brand/50',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="py-6 text-center font-body text-sm text-fall">No se pudo cargar: {error}</p>
      ) : !data || data.length === 0 ? (
        <p className="py-6 text-center font-body text-sm text-ink/50">Sin datos para este periodo.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="w-full max-w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={74} paddingAngle={2}>
                  {chartData.map((entry, i) => (
                    <Cell key={entry.label} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => activeOption.format(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full flex-1 space-y-1.5">
            {chartData.map((d, i) => (
              <li key={d.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink/80">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  {d.label}
                </span>
                <span className="font-body tabular-nums text-ink/70">
                  {activeOption.format(d.value)}
                  {metric !== 'roas' && total > 0 && (
                    <span className="ml-1.5 text-ink/40">({((d.value / total) * 100).toFixed(1)}%)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const EMPTY_META = { geo: [], demographics: [] };

// Fetches ONLY Meta's breakdown data — placed right before Meta's funnel in
// AdquisicionShell.js (split from Google's version so each can sit in its
// own channel's section, per the client's request).
export function MetaAudienceBreakdown({ range }) {
  const [meta, setMeta] = useState(EMPTY_META);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJSON(`/api/meta/breakdowns?start=${range.start}&end=${range.end}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setMeta(EMPTY_META);
        } else {
          setError(null);
          setMeta({ geo: res.geo, demographics: res.demographics });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const byAge = useMemo(() => aggregateBy(meta.demographics, 'ageRange'), [meta.demographics]);
  const byGender = useMemo(() => aggregateBy(meta.demographics, 'gender'), [meta.demographics]);

  return (
    <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      {error && <ErrorBanner errors={{ meta: error }} />}
      <SectionHeader eyebrow="Meta Ads" title="Desglose de audiencia y ubicación" />
      <div className="grid gap-4 sm:grid-cols-2">
        <BreakdownCard
          data={meta.geo}
          title="Gasto por estado"
          note="Solo inversión — Meta no expone ciudad, y compras/ROAS no tienen datos en este desglose"
          error={error}
          showMetricToggle={false}
        />
        <BreakdownCard data={byAge} title="Gasto por edad" error={error} />
        <BreakdownCard data={byGender} title="Gasto por género" error={error} />
      </div>
    </div>
  );
}

const EMPTY_GOOGLE = { byRegion: [], byCity: [] };

// Fetches ONLY Google's breakdown data — placed right before Google's
// funnel. Age/género removed entirely (see route.js comment): Performance
// Max campaigns structurally can't report on those in Google Ads.
export function GoogleLocationBreakdown({ range }) {
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJSON(`/api/google/breakdowns?start=${range.start}&end=${range.end}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setGoogle(EMPTY_GOOGLE);
        } else {
          setError(null);
          setGoogle({ byRegion: res.byRegion, byCity: res.byCity });
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
    <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      {error && <ErrorBanner errors={{ google: error }} />}
      <SectionHeader
        eyebrow="Google Ads"
        title="Desglose por ubicación"
        note="Sin edad/género — Performance Max no lo soporta"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <BreakdownCard data={google.byRegion} title="Gasto por estado" error={error} />
        <BreakdownCard data={google.byCity} title="Gasto por ciudad" error={error} />
      </div>
      <p className="mt-2 font-body text-[10px] text-ink/40">
        Google Ads no puede reportar gasto por edad/género en campañas Performance Max — sus reportes de
        edad y género dependen de "grupos de anuncios", y PMax no usa esa estructura (usa "grupos de
        activos" en su lugar). Confirmado por el equipo de soporte de la API de Google Ads.
      </p>
    </div>
  );
}
