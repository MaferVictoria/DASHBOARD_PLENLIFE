'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/format';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      <p className="font-mono text-sm font-semibold text-ink">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function MonthlySpendChart({ data, barColor = '#173C32', label }) {
  return (
    <div className="bg-panel p-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">{label}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E2DED2" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: '#E2DED2' }}
            tick={{ fontSize: 11, fill: '#16241E99', fontFamily: 'var(--font-mono)' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={0}
            tick={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#16241E0A' }} />
          <Bar dataKey="value" fill={barColor} radius={[2, 2, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
