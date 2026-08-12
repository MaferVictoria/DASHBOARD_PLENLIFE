// Centralized date-range logic used by the selector and the API routes.

export const PRESETS = [
  { id: '7d', label: '7 días', days: 7 },
  { id: '14d', label: '14 días', days: 14 },
  { id: '30d', label: '30 días', days: 30 },
];

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

export function getPresetRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: toISODate(start), end: toISODate(end) };
}

export function defaultRange() {
  return { id: '30d', ...getPresetRange(30) };
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
