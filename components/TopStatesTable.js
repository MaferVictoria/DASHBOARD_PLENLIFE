import { formatCurrency, formatNumber, formatSpanishDateRange, formatChangeText } from '@/lib/format';
import { computeChange } from '@/lib/metrics';

// data: [{ start, end, states: [{state, sales, orders, previousSales}] }]
// First block = current period (brand-tinted header). Second block, when
// present, is the frozen "mes anterior" comparison (neutral/gray header) —
// deliberately styled differently so the two are never confused at a glance.
export default function TopStatesTable({ data }) {
  const colsClass = data.length >= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';
  return (
    <div className={`grid gap-px border border-line bg-line ${colsClass}`}>
      {data.map((block, blockIndex) => {
        const isCurrent = blockIndex === 0;
        return (
          <div key={`${block.start}-${block.end}`} className={isCurrent ? 'bg-panel p-4' : 'bg-paper p-4'}>
            <p
              className={`mb-3 font-body text-[10px] uppercase tracking-[0.14em] ${
                isCurrent ? 'text-brand' : 'text-ink/45'
              }`}
            >
              {formatSpanishDateRange(block.start, block.end)}
            </p>
            <ol className="space-y-3">
              {block.states.map((s, i) => {
                const change = computeChange(s.sales, s.previousSales);
                const changeText = formatChangeText(change, formatCurrency);
                const colorClass =
                  change?.direction === 'up' ? 'text-rise' : change?.direction === 'down' ? 'text-fall' : 'text-ink/40';
                return (
                  <li key={s.state}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink/80">
                        <span className="font-body text-xs text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                        {s.state}
                      </span>
                      <span className="font-body font-semibold tabular-nums text-ink">{formatCurrency(s.sales)}</span>
                    </div>
                    <div className="ml-6 mt-0.5 flex items-center justify-between">
                      <span className="font-body text-xs font-bold text-brand">
                        {formatNumber(s.orders)} {s.orders === 1 ? 'pedido' : 'pedidos'}
                      </span>
                      <span className={`font-body text-[10px] ${colorClass}`}>{changeText}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
