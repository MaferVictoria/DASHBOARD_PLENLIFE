// Centralized date-range logic used by the selector and the API routes.

export const PRESETS = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '14d', label: 'Últimos 14 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: 'last-month', label: 'Mes pasado' },
  { id: 'this-month', label: 'Mes actual' },
  { id: 'all', label: 'Todo el histórico' },
];

// Only used as the lower bound for "Todo el histórico" so real queries don't
// scan years of empty history. Adjust to whenever the Plenlife store
// actually started taking orders.
export const ALL_TIME_START = '2015-01-01';

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgoRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: toISODate(start), end: toISODate(end) };
}

export function computeRangeForPreset(id) {
  const now = new Date();
  const today = toISODate(now);

  switch (id) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const iso = toISODate(y);
      return { start: iso, end: iso };
    }
    case '7d':
      return daysAgoRange(7);
    case '14d':
      return daysAgoRange(14);
    case '30d':
      return daysAgoRange(30);
    case 'last-month': {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd = new Date(firstOfThisMonth);
      lastMonthEnd.setDate(0); // day 0 rolls back to the last day of the previous month
      const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
      return { start: toISODate(lastMonthStart), end: toISODate(lastMonthEnd) };
    }
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toISODate(start), end: today };
    }
    case 'all':
      return { start: ALL_TIME_START, end: today };
    default:
      return daysAgoRange(30);
  }
}

export function defaultRange() {
  return { id: '30d', ...computeRangeForPreset('30d') };
}

// Immediately-preceding period of the same length — the standard "compare to
// previous period" convention (same approach GA4 / ad platforms use).
// Returns null for "Todo el histórico": there's no meaningful "previous"
// period to compare all-time totals against.
export function getPreviousRange(range) {
  if (range.id === 'all') return null;
  const lengthDays = daysBetween(range.start, range.end);
  const prevEnd = new Date(range.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (lengthDays - 1));
  return { start: toISODate(prevStart), end: toISODate(prevEnd) };
}

// Month labels Jan..current month (this is what "monthly breakdown" charts use;
// new months appear automatically as the year progresses).
export function monthsSoFar(referenceDate = new Date()) {
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const currentMonthIndex = referenceDate.getMonth(); // 0-indexed
  return labels.slice(0, currentMonthIndex + 1);
}

export function daysBetween(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}
