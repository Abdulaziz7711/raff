import { detail, saveTitle, fail } from './_lib/catalog.js';

// Fetches one title from RAWG/TMDB and stores it in the titles table, so entries, lists and favourites can point at it.
export default async function handler(req, res) {
  try {
    const d = await detail(String(req.query.id || ''));
    await saveTitle(d.title);
    // ?ensure=1 is used right before logging; never serve that one from the CDN
    res.setHeader('cache-control', req.query.ensure ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(d);
  } catch (e) { fail(res, e); }
}
