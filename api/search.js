import { search, KINDS, HttpError, fail } from './_lib/catalog.js';

export default async function handler(req, res) {
  try {
    const kind = String(req.query.kind || 'games');
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), 10);
    if (!KINDS.includes(kind)) throw new HttpError(400, 'bad kind');
    if (!q) return res.status(200).json({ results: [] });
    const results = await search(kind, q, page);
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ results });
  } catch (e) { fail(res, e); }
}
