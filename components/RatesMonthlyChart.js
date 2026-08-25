'use client';

import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-body text-xs text-ink/70">
          {p.name}: <span className="font-semibold text-ink">{Number(p.value).toFixed(2)}%</span>
        </p>
      ))}
    </div>
  );
}

// Dos ejes Y deliberadamente: Conversión y ATC (ambas rondan 0-5%) en el
// izquierdo, escala automática; Rebote (60-90% típico) en el derecho, FIJO
// 0-100 — meterlas todas en un solo eje aplastaría Conversión/ATC contra el
// piso. type="monotone" en las 3 líneas evita que la curva se salga del
// rango real de los datos entre dos puntos (overshoot).
export default function RatesMonthlyChart({ data }) {
  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">
          Conversión, ATC y Rebote — por mes (histórico completo)
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#086eb6' }} />
            Conversión
          </span>
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#E8A33D' }} />
            ATC
          </span>
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
            Rebote (eje derecho, 0-100)
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D9E6EF" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: '#D9E6EF' }}
            tick={{ fontSize: 11, fill: '#0B2A4599', fontFamily: 'var(--font-poppins)' }}
          />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={0} tick={false} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={0} tick={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            yAxisId="left"
            dataKey="tasaConversion"
            name="Conversión"
            type="monotone"
            stroke="#086eb6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#086eb6', strokeWidth: 0 }}
          />
          <Line
            yAxisId="left"
            dataKey="tasaAtc"
            name="ATC"
            type="monotone"
            stroke="#E8A33D"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#E8A33D', strokeWidth: 0 }}
          />
          <Line
            yAxisId="right"
            dataKey="tasaRebote"
            name="Rebote"
            type="monotone"
            stroke="#8B5CF6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#8B5CF6', strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
