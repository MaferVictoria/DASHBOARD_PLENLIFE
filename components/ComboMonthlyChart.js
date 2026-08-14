'use client';

import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

function CustomTooltip({ active, payload, label, spendLabel, salesLabel }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const failed = point?.failed;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      {failed ? (
        <p className="font-body text-sm font-semibold text-fall">No se pudo cargar</p>
      ) : (
        <>
          <p className="font-body text-xs text-ink/70">
            {spendLabel}: <span className="font-semibold text-ink">{formatCurrency(point?.spend)}</span>
          </p>
          <p className="font-body text-xs text-ink/70">
            {salesLabel}: <span className="font-semibold text-ink">{formatCurrency(point?.sales)}</span>
          </p>
        </>
      )}
    </div>
  );
}

// Bar (spend, left axis) + line (sales, right axis) combo chart. The two
// series live on separate axes on purpose — ad spend and revenue are
// usually a different order of magnitude, and forcing them onto one axis
// would flatten whichever is smaller.
export default function ComboMonthlyChart({ data, label, spendLabel, salesLabel, spendColor = '#086eb6', salesColor = '#009dde' }) {
  const hasGaps = data.some((d) => d.spend === null || d.spend === undefined);
  const chartData = data.map((d) => ({
    ...d,
    spend: d.spend ?? 0,
    sales: d.sales ?? 0,
    failed: d.spend === null,
  }));

  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{label}</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: spendColor }} />
            {spendLabel}
          </span>
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: salesColor }} />
            {salesLabel}
          </span>
          {hasGaps && <span className="font-body text-[10px] text-fall">* algunos meses no cargaron</span>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D9E6EF" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: '#D9E6EF' }}
            tick={{ fontSize: 11, fill: '#0B2A4599', fontFamily: 'var(--font-poppins)' }}
          />
          <YAxis yAxisId="spend" tickLine={false} axisLine={false} width={0} tick={false} />
          <YAxis yAxisId="sales" orientation="right" tickLine={false} axisLine={false} width={0} tick={false} />
          <Tooltip content={<CustomTooltip spendLabel={spendLabel} salesLabel={salesLabel} />} cursor={{ fill: '#0B2A450A' }} />
          <Bar yAxisId="spend" dataKey="spend" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {chartData.map((entry) => (
              <Cell key={entry.month} fill={entry.failed ? '#D9E6EF' : spendColor} />
            ))}
          </Bar>
          <Line
            yAxisId="sales"
            dataKey="sales"
            type="monotone"
            stroke={salesColor}
            strokeWidth={2.5}
            dot={{ r: 3, fill: salesColor, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
