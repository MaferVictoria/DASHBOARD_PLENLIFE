import { formatCurrency, formatNumber } from '@/lib/format';

export default function TopStatesTable({ data }) {
  const colsClass = data.length >= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';
  return (
    <div className={`grid gap-px border border-line bg-line ${colsClass}`}>
      {data.map(({ label, states }) => (
        <div key={label} className="bg-panel p-4">
          <p className="mb-2 font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{label}</p>
          <ol className="space-y-1.5">
            {states.map((s, i) => (
              <li key={s.state} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink/80">
                  <span className="font-body text-xs text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    {s.state}
                    <span className="ml-1.5 font-body text-xs text-ink/40">
                      ({formatNumber(s.orders)} {s.orders === 1 ? 'pedido' : 'pedidos'})
                    </span>
                  </span>
                </span>
                <span className="font-body tabular-nums text-ink/80">{formatCurrency(s.sales)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
