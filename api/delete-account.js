import { supabaseEnv, HttpError, fail } from './_lib/catalog.js';

// Deleting an auth user needs the service key, so it happens here after checking the caller's own session token.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only');
    const { url, service } = supabaseEnv();
    if (!url || !service) throw new HttpError(500, 'SUPABASE_SERVICE_ROLE_KEY is not set');
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'not signed in');
    const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, authorization: 'Bearer ' + token } });
    if (!me.ok) throw new HttpError(401, 'not signed in');
    const { id } = await me.json();
    const del = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: service, authorization: 'Bearer ' + service } });
    if (!del.ok) throw new HttpError(502, 'could not delete');
    res.status(200).json({ ok: true });
  } catch (e) { fail(res, e); }
}
