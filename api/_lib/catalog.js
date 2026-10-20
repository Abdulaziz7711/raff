// Catalog adapters: RAWG for games, TMDB for movies and shows.
// Every title is normalised to one shape and gets an id like g3498 (RAWG), m603 (TMDB movie) or s1399 (TMDB tv).

const RAWG = 'https://api.rawg.io/api';
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const GAME_GENRES = {
  Action:'أكشن', Adventure:'مغامرة', RPG:'آر بي جي', Shooter:'تصويب', Puzzle:'ألغاز', Racing:'سباقات', Sports:'رياضة',
  Strategy:'استراتيجية', Simulation:'محاكاة', Platformer:'منصات', Fighting:'قتال', Indie:'مستقلة', Casual:'كاجوال',
  Arcade:'أركيد', Family:'عائلية', 'Board Games':'ألعاب لوحية', Educational:'تعليمية', Card:'بطاقات',
  'Massively Multiplayer':'أونلاين جماعي'
};
const TMDB_GENRES = {
  28:'أكشن', 12:'مغامرة', 16:'رسوم متحركة', 35:'كوميديا', 80:'جريمة', 99:'وثائقي', 18:'دراما', 10751:'عائلي',
  14:'فانتازيا', 36:'تاريخ', 27:'رعب', 10402:'موسيقى', 9648:'غموض', 10749:'رومانسي', 878:'خيال علمي',
  10770:'فيلم تلفزيوني', 53:'إثارة', 10752:'حرب', 37:'غربي', 10759:'أكشن ومغامرة', 10762:'أطفال', 10763:'أخبار',
  10764:'واقع', 10765:'خيال علمي وفانتازيا', 10766:'دراما طويلة', 10767:'حواري', 10768:'حرب وسياسة'
};

const year = d => (d && /^\d{4}/.test(d) ? +d.slice(0, 4) : null);
// RAWG serves big originals; its CDN can resize on the fly
const rawgImg = (u, w = 420) => (u ? u.replace('/media/games/', `/media/resize/${w}/-/games/`).replace('/media/screenshots/', `/media/resize/${w}/-/screenshots/`) : null);
const tmdbImg = (p, size) => (p ? IMG + size + p : null);
const isAnime = t => (t.genre_ids || (t.genres || []).map(g => g.id)).includes(16) && ((t.origin_country || []).includes('JP') || t.original_language === 'ja');

/* ---------------- RAWG ---------------- */
async function rawg(path, params = {}) {
  const key = process.env.RAWG_API_KEY;
  if (!key) throw new HttpError(500, 'RAWG_API_KEY is not set');
  const u = new URL(RAWG + path);
  u.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (r.status === 404) throw new HttpError(404, 'not found');
  if (!r.ok) throw new HttpError(502, `RAWG ${r.status}`);
  return r.json();
}
function gameCard(g) {
  return {
    id: 'g' + g.id, kind: 'games', title: g.name, year: year(g.released),
    poster: rawgImg(g.background_image), backdrop: g.background_image || null,
    genres: (g.genres || []).map(x => GAME_GENRES[x.name] || x.name).slice(0, 3),
    platforms: (g.parent_platforms || g.platforms || []).map(p => p.platform.name).slice(0, 6)
  };
}
async function gameDetail(id) {
  const [g, series] = await Promise.all([
    rawg(`/games/${id}`),
    rawg(`/games/${id}/game-series`, { page_size: 12 }).catch(() => ({ results: [] }))
  ]);
  return {
    title: {
      ...gameCard(g),
      original_title: g.name_original && g.name_original !== g.name ? g.name_original : null,
      backdrop: g.background_image_additional || g.background_image || null,
      by: (g.developers || []).map(d => d.name).slice(0, 2).join('، ') || null,
      platforms: (g.platforms || []).map(p => p.platform.name).slice(0, 10),
      about: (g.description_raw || '').trim().slice(0, 1500) || null
    },
    extra: { metacritic: g.metacritic || null, website: g.website || null, playtime: g.playtime || null, source: `https://rawg.io/games/${g.slug || g.id}` },
    related: (series.results || []).map(gameCard)
  };
}

/* ---------------- TMDB ---------------- */
async function tmdb(path, params = {}) {
  const tok = process.env.TMDB_TOKEN || process.env.TMDB_API_KEY;
  if (!tok) throw new HttpError(500, 'TMDB_TOKEN is not set');
  const u = new URL(TMDB + path);
  const headers = { accept: 'application/json' };
  // accepts either the long v4 "API Read Access Token" or the short v3 "API Key"
  if (tok.startsWith('eyJ')) headers.authorization = 'Bearer ' + tok; else u.searchParams.set('api_key', tok);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  const r = await fetch(u, { headers });
  if (r.status === 404) throw new HttpError(404, 'not found');
  if (!r.ok) throw new HttpError(502, `TMDB ${r.status}`);
  return r.json();
}
function movieCard(m) {
  return {
    id: 'm' + m.id, kind: 'movies', title: m.title, year: year(m.release_date),
    poster: tmdbImg(m.poster_path, 'w342'), backdrop: tmdbImg(m.backdrop_path, 'w1280'),
    genres: (m.genre_ids || (m.genres || []).map(g => g.id)).map(g => TMDB_GENRES[g]).filter(Boolean).slice(0, 3)
  };
}
function showCard(s) {
  return {
    id: 's' + s.id, kind: 'shows', title: s.name, year: year(s.first_air_date),
    poster: tmdbImg(s.poster_path, 'w342'), backdrop: tmdbImg(s.backdrop_path, 'w1280'),
    genres: (s.genre_ids || (s.genres || []).map(g => g.id)).map(g => TMDB_GENRES[g]).filter(Boolean).slice(0, 3),
    sub: isAnime(s) ? 'أنمي' : 'مسلسل'
  };
}
const arabicOverview = d => (d.translations?.translations || []).find(t => t.iso_639_1 === 'ar')?.data?.overview?.trim();
async function movieDetail(id) {
  const m = await tmdb(`/movie/${id}`, { language: 'en-US', append_to_response: 'credits,recommendations,translations' });
  const directors = (m.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name);
  return {
    title: {
      ...movieCard(m),
      original_title: m.original_title !== m.title ? m.original_title : null,
      by: directors.slice(0, 2).join('، ') || null,
      about: arabicOverview(m) || m.overview || null
    },
    extra: {
      runtime: m.runtime || null, tagline: m.tagline || null, source: `https://www.themoviedb.org/movie/${m.id}`,
      cast: (m.credits?.cast || []).slice(0, 8).map(c => c.name)
    },
    related: (m.recommendations?.results || []).slice(0, 12).map(movieCard)
  };
}
async function showDetail(id) {
  const s = await tmdb(`/tv/${id}`, { language: 'en-US', append_to_response: 'credits,recommendations,translations' });
  const by = (s.created_by || []).map(c => c.name).concat((s.networks || []).map(n => n.name));
  return {
    title: {
      ...showCard(s),
      original_title: s.original_name !== s.name ? s.original_name : null,
      by: by.slice(0, 2).join('، ') || null,
      about: arabicOverview(s) || s.overview || null
    },
    extra: {
      seasons: s.number_of_seasons || null, episodes: s.number_of_episodes || null, status: s.status || null,
      source: `https://www.themoviedb.org/tv/${s.id}`, cast: (s.credits?.cast || []).slice(0, 8).map(c => c.name)
    },
    related: (s.recommendations?.results || []).slice(0, 12).map(showCard)
  };
}

/* ---------------- public API ---------------- */
export const KINDS = ['games', 'movies', 'shows'];

export async function search(kind, q, page = 1) {
  if (kind === 'games') {
    const r = await rawg('/games', { search: q, page_size: 20, page, search_precise: 'true' });
    return r.results.map(gameCard);
  }
  if (kind === 'movies') {
    const r = await tmdb('/search/movie', { query: q, page, include_adult: 'false', language: 'en-US' });
    return r.results.map(movieCard);
  }
  const r = await tmdb('/search/tv', { query: q, page, include_adult: 'false', language: 'en-US' });
  return r.results.map(showCard);
}

export async function detail(id) {
  const m = /^([gms])(\d+)$/.exec(id || '');
  if (!m) throw new HttpError(400, 'bad id');
  return m[1] === 'g' ? gameDetail(m[2]) : m[1] === 'm' ? movieDetail(m[2]) : showDetail(m[2]);
}

const iso = d => d.toISOString().slice(0, 10);
export async function discover(kind, feed = 'trending', page = 1) {
  if (kind === 'games') {
    const now = new Date(), past = new Date(now), future = new Date(now);
    past.setMonth(past.getMonth() - 6); future.setFullYear(future.getFullYear() + 1);
    const p = {
      trending: { ordering: '-added', dates: `${iso(past)},${iso(now)}` },
      popular: { ordering: '-added' },
      top: { ordering: '-metacritic', metacritic: '85,100' },
      upcoming: { ordering: '-added', dates: `${iso(now)},${iso(future)}` }
    }[feed] || {};
    const r = await rawg('/games', { ...p, page_size: 20, page });
    return r.results.map(gameCard);
  }
  if (kind === 'movies') {
    const path = { trending: '/trending/movie/week', popular: '/movie/popular', top: '/movie/top_rated', upcoming: '/movie/upcoming' }[feed] || '/trending/movie/week';
    const r = await tmdb(path, { page, language: 'en-US' });
    return r.results.map(movieCard);
  }
  if (feed === 'anime') {
    const r = await tmdb('/discover/tv', { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc', page, language: 'en-US' });
    return r.results.map(showCard);
  }
  const path = { trending: '/trending/tv/week', popular: '/tv/popular', top: '/tv/top_rated', upcoming: '/tv/on_the_air' }[feed] || '/trending/tv/week';
  const r = await tmdb(path, { page, language: 'en-US' });
  return r.results.map(showCard);
}

/* ---------------- write-through cache into Supabase ---------------- */
export function supabaseEnv() {
  return {
    url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
    service: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  };
}
export async function saveTitle(t) {
  const { url, service } = supabaseEnv();
  if (!url || !service) throw new HttpError(500, 'SUPABASE_SERVICE_ROLE_KEY is not set');
  const row = {
    id: t.id, kind: t.kind, title: t.title, original_title: t.original_title || null, year: t.year || null,
    poster: t.poster || null, backdrop: t.backdrop || null, by: t.by || null, genres: t.genres || [],
    platforms: t.platforms || [], sub: t.sub || null, about: t.about || null, updated_at: new Date().toISOString()
  };
  const r = await fetch(`${url}/rest/v1/titles`, {
    method: 'POST',
    headers: { apikey: service, authorization: 'Bearer ' + service, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new HttpError(502, 'could not save title: ' + (await r.text()).slice(0, 200));
}

export function fail(res, e) {
  const status = e instanceof HttpError ? e.status : 500;
  if (status >= 500) console.error(e);
  res.status(status).json({ error: e.message || 'error' });
}
