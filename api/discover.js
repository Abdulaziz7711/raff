import { discover, KINDS, HttpError, fail } from './_lib/catalog.js';

const FEEDS = ['trending', 'popular', 'top', 'upcoming', 'anime'];

export default async function handler(req, res) {
  try {
    const kind = String(req.query.kind || 'games');
    const feed = String(req.query.feed || 'trending');
    const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), 20);
    if (!KINDS.includes(kind) || !FEEDS.includes(feed)) throw new HttpError(400, 'bad kind or feed');
    const results = await discover(kind, feed, page);
    res.setHeader('cache-control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ results });
  } catch (e) { fail(res, e); }
}
