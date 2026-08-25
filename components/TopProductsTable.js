import { formatCurrency, formatNumber, formatSpanishDateRange, formatChangeText } from '@/lib/format';
import { computeChange } from '@/lib/metrics';

// data: [{ start, end, products: [{product, sales, units, previousSales}] }]
// Same current/previous visual contrast convention as TopStatesTable.
export default function TopProductsTable({ data }) {
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
              {block.products.map((p, i) => {
                const change = computeChange(p.sales, p.previousSales);
                const changeText = formatChangeText(change, formatCurrency);
                const colorClass =
                  change?.direction === 'up' ? 'text-rise' : change?.direction === 'down' ? 'text-fall' : 'text-ink/40';
                return (
                  <li key={p.product}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-ink/80">
                        <span className="font-body text-xs text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                        <span className="truncate">{p.product}</span>
                      </span>
                      <span className="shrink-0 font-body font-semibold tabular-nums text-ink">
                        {formatCurrency(p.sales)}
                      </span>
                    </div>
                    <div className="ml-6 mt-0.5 flex items-center justify-between">
                      <span className="font-body text-xs font-bold text-brand">
                        {formatNumber(p.units)} {p.units === 1 ? 'unidad' : 'unidades'}
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
