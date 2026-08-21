// Shared fetch helper used by every page shell. Never throws — a failed
// request comes back as { error: '...' } so callers can render it inline
// (red banner) instead of crashing the whole page.
export async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: json.error || `Error ${res.status} al consultar ${url}` };
    }
    return json;
  } catch (err) {
    return { error: err.message || `No se pudo conectar con ${url}` };
  }
}
