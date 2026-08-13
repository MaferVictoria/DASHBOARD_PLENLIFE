export function formatCurrency(value, currency = 'MXN') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-MX').format(value);
}

export function formatRatio(value, suffix = 'x') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}${suffix}`;
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

// Turns a computeChange() result into the small line shown under each KPI:
// "+$1,234 (+12.3%) vs. anterior". `formatFn` formats the raw absolute
// delta the same way the metric itself is formatted (currency/number/ratio).
export function formatChangeText(change, formatFn) {
  if (!change) return 'Todo el histórico — sin periodo previo';
  const { absolute, percent, direction } = change;
  if (direction === 'flat' && percent === null) return 'Sin cambio vs. periodo anterior';
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
  const absText = formatFn(Math.abs(absolute));
  const percentText = percent === null ? '' : ` (${sign}${Math.abs(percent).toFixed(1)}%)`;
  return `${sign}${absText}${percentText} vs. anterior`;
}
