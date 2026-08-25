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
  if (!change) return 'Sin comparación disponible';
  const { absolute, percent, direction } = change;
  if (direction === 'flat' && percent === null) return 'Sin cambio vs. periodo anterior';
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
  const absText = formatFn(Math.abs(absolute));
  const percentText = percent === null ? '' : ` (${sign}${Math.abs(percent).toFixed(1)}%)`;
  return `${sign}${absText}${percentText} vs. anterior`;
}

// "2026-08-01" -> "1 de agosto de 2026". Parsed as a plain calendar date
// (not a Date-with-timezone) so it can't drift a day depending on the
// browser/server's local timezone.
export function formatSpanishDate(isoDate) {
  if (!isoDate) return '';
  const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

export function formatSpanishDateRange(start, end) {
  if (!start || !end) return '';
  if (start === end) return formatSpanishDate(start);
  return `${formatSpanishDate(start)} → ${formatSpanishDate(end)}`;
}
