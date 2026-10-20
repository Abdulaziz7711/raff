// Talks to our own /api functions, which proxy RAWG and TMDB with the secret keys.
import { sb } from './supabase.js';

const cache = new Map();
async function get(url, { fresh = false, signal } = {}) {
  if (!fresh && cache.has(url)) return cache.get(url);
  const r = await fetch(url, { signal });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || 'request failed'), { status: r.status });
  if (!fresh) cache.set(url, body);
  return body;
}

export const search = (kind, q, opts) => get(`/api/search?kind=${kind}&q=${encodeURIComponent(q)}`, opts).then(r => r.results);
export const discover = (kind, feed = 'trending', page = 1) => get(`/api/discover?kind=${kind}&feed=${feed}&page=${page}`).then(r => r.results);
export const detail = id => get(`/api/title?id=${encodeURIComponent(id)}`);

// Make sure the title row exists in the database before an entry, list item or favourite points at it.
const ensured = new Set();
export async function ensureTitle(id) {
  if (ensured.has(id)) return;
  const { data } = await sb.from('titles').select('id').eq('id', id).maybeSingle();
  if (!data) await get(`/api/title?id=${encodeURIComponent(id)}&ensure=1`, { fresh: true });
  ensured.add(id);
}

export const kindOf = id => ({ g: 'games', m: 'movies', s: 'shows' }[String(id)[0]]);
