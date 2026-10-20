// Demo build only: stands in for src/lib/catalog.js. A fixed, built-in catalog instead of RAWG / TMDB,
// so the demo page needs no keys and no server. Covers fall back to the coloured gradients.
import { sb } from './mock-supabase.js';
import { ALL } from './catalog-data.js';

export const CATALOG = ALL;
const byId = new Map(ALL.map(t => [t.id, { poster: null, backdrop: null, platforms: [], ...t }]));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const wait = (v, ms = 120) => new Promise(r => setTimeout(() => r(v), ms));

export async function search(kind, q) {
  const n = norm(q);
  const hits = ALL.filter(t => t.kind === kind && norm(t.title).includes(n));
  // exact match first, then titles that start with the query, then the rest
  const rank = t => (norm(t.title) === n ? 2 : norm(t.title).startsWith(n) ? 1 : 0);
  hits.sort((a, b) => rank(b) - rank(a) || b.year - a.year);
  return wait(hits.slice(0, 20).map(t => byId.get(t.id)));
}
export async function discover(kind, feed = 'trending', page = 1) {
  if (page > 1) return wait([]);
  let list = ALL.filter(t => t.kind === kind);
  if (feed === 'anime') list = list.filter(t => t.sub === 'أنمي');
  if (feed === 'trending' || feed === 'upcoming') list = [...list].sort((a, b) => b.year - a.year);
  if (feed === 'top') list = [...list].sort((a, b) => a.year - b.year);
  return wait(list.map(t => byId.get(t.id)));
}
export async function detail(id) {
  const t = byId.get(id);
  if (!t) throw Object.assign(new Error('not found'), { status: 404 });
  const related = ALL.filter(x => x.kind === t.kind && x.id !== id && (x.by === t.by || x.genres[0] === t.genres[0])).slice(0, 12).map(x => byId.get(x.id));
  return wait({ title: t, extra: { source: t.kind === 'games' ? 'https://rawg.io' : 'https://www.themoviedb.org' }, related });
}
export async function ensureTitle(id) {
  const t = byId.get(id);
  if (t) sb._putTitle(t);
}
export const kindOf = id => ({ g: 'games', m: 'movies', s: 'shows' }[String(id)[0]]);
export const titleById = id => byId.get(id);
