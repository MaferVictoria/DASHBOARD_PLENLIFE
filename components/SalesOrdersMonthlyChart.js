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
import { formatCurrency, formatNumber } from '@/lib/format';

function CustomTooltip({ active, payload, label }) {
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
            Ventas netas: <span className="font-semibold text-ink">{formatCurrency(point?.sales)}</span>
          </p>
          <p className="font-body text-xs text-ink/70">
            Pedidos: <span className="font-semibold text-ink">{formatNumber(point?.orders)}</span>
          </p>
        </>
      )}
    </div>
  );
}

// Bar = ventas netas (currency, left axis), line = número de pedidos (count,
// right axis) — same combo-chart pattern as everywhere else in the
// dashboard, just with a count instead of a second currency series.
export default function SalesOrdersMonthlyChart({ data }) {
  const hasGaps = data.some((d) => d.sales === null || d.sales === undefined);
  const chartData = data.map((d) => ({
    ...d,
    sales: d.sales ?? 0,
    orders: d.orders ?? 0,
    failed: d.sales === null,
  }));

  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">
          Ventas netas y pedidos — por mes
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#086eb6' }} />
            Ventas netas
          </span>
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#009dde' }} />
            Pedidos
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
          <YAxis yAxisId="sales" tickLine={false} axisLine={false} width={0} tick={false} />
          <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} width={0} tick={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#0B2A450A' }} />
          <Bar yAxisId="sales" dataKey="sales" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {chartData.map((entry) => (
              <Cell key={entry.month} fill={entry.failed ? '#D9E6EF' : '#086eb6'} />
            ))}
          </Bar>
          <Line
            yAxisId="orders"
            dataKey="orders"
            type="monotone"
            stroke="#009dde"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#009dde', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
