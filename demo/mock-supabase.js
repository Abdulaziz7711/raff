// Demo build only: stands in for src/lib/supabase.js. A small in-browser imitation of the Supabase client
// (query builder, embeds, auth, storage) over tables kept in localStorage, so the whole app runs inside one page.
// It mirrors supabase/schema.sql: same tables, counters, defaults and constraints, but it's for trying the UI only.
import { seed } from './seed.js';

const KEY = 'raff-demo-v1';
const SESSION = 'raff-demo-session';
const now = () => new Date().toISOString();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

let db;
try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
if (!db || !db.profiles) db = seed(uuid);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { } };
save();

/* ---------- relationships (same foreign keys as schema.sql) ---------- */
const ONE = {
  'entries.titles': 'title_id', 'entries.profiles': 'user_id', 'favorites.titles': 'title_id', 'lists.profiles': 'user_id',
  'list_items.titles': 'title_id', 'review_likes.profiles': 'user_id', 'review_likes.entries': 'entry_id',
  'comments.profiles': 'user_id', 'comments.entries': 'entry_id', 'list_likes.lists': 'list_id'
};
const MANY = { 'lists.list_items': 'list_id' };
const HINTS = { follows_follower_id_fkey: 'follower_id', follows_following_id_fkey: 'following_id' };
const UNIQUE = {
  profiles: [['username']], entries: [['user_id', 'title_id']], favorites: [['user_id', 'kind', 'position'], ['user_id', 'title_id']],
  list_items: [['list_id', 'title_id']], follows: [['follower_id', 'following_id']], review_likes: [['user_id', 'entry_id']],
  list_likes: [['user_id', 'list_id']], titles: [['id']]
};

/* ---------- views ---------- */
function view(name) {
  if (name === 'title_stats') {
    const g = new Map();
    for (const e of db.entries) {
      const s = g.get(e.title_id) || { title_id: e.title_id, logs: 0, wishes: 0, playing: 0, reviews: 0, ratings: 0, sum: 0, hist: Array(10).fill(0) };
      if (e.status !== 'wish') s.logs++; else s.wishes++;
      if (e.status === 'playing') s.playing++;
      if (e.review) s.reviews++;
      if (+e.rating > 0) { s.ratings++; s.sum += +e.rating; s.hist[Math.round(e.rating * 2) - 1]++; }
      g.set(e.title_id, s);
    }
    return [...g.values()].map(({ sum, ...s }) => ({ ...s, avg_rating: s.ratings ? +(sum / s.ratings).toFixed(2) : null }));
  }
  if (name === 'profile_stats') return db.profiles.map(p => ({
    id: p.id,
    logs: db.entries.filter(e => e.user_id === p.id && e.status !== 'wish').length,
    reviews: db.entries.filter(e => e.user_id === p.id && e.review).length,
    followers: db.follows.filter(f => f.following_id === p.id).length,
    following: db.follows.filter(f => f.follower_id === p.id).length,
    likes_received: db.entries.filter(e => e.user_id === p.id).reduce((n, e) => n + e.likes_count, 0)
  }));
  if (name === 'popular_titles') {
    const since = Date.now() - 30 * 864e5, n = new Map();
    db.entries.forEach(e => { if (new Date(e.updated_at) > since) n.set(e.title_id, (n.get(e.title_id) || 0) + 1); });
    return [...n].map(([id, c]) => ({ ...db.titles.find(t => t.id === id), recent_logs: c })).filter(t => t.id);
  }
  return db[name] || [];
}

/* ---------- select parsing + embedding ---------- */
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseSel(s = '*') {
  const sel = { star: false, cols: [], embeds: [] };
  for (const item of splitTop(s)) {
    const m = /^(?:(\w+):)?(\w+)((?:!\w+)*)\(([\s\S]*)\)$/.exec(item);
    if (m) {
      const hints = m[3].split('!').filter(Boolean);
      sel.embeds.push({ alias: m[1] || m[2], table: m[2], inner: hints.includes('inner'), hint: hints.find(h => h !== 'inner'), sel: parseSel(m[4]) });
    } else if (item === '*') sel.star = true;
    else sel.cols.push(item);
  }
  return sel;
}
// full row (all columns) plus embedded objects; projection happens after filtering
function expand(table, row, sel) {
  const out = { ...row };
  for (const em of sel.embeds) {
    const key = `${table}.${em.table}`;
    if (MANY[key]) {
      out[em.alias] = view(em.table).filter(r => r[MANY[key]] === row.id).map(r => expand(em.table, r, em.sel));
    } else {
      const fk = (em.hint && (HINTS[em.hint] || em.hint)) || ONE[key];
      const target = view(em.table).find(r => r.id === row[fk]);
      out[em.alias] = target ? expand(em.table, target, em.sel) : null;
    }
    out['__inner_' + em.alias] = em.inner;
  }
  return out;
}
function project(row, sel) {
  const out = {};
  if (sel.star) Object.keys(row).forEach(k => { if (!k.startsWith('__') && !sel.embeds.some(e => e.alias === k)) out[k] = row[k]; });
  sel.cols.forEach(c => { out[c] = row[c]; });
  sel.embeds.forEach(e => { const v = row[e.alias]; out[e.alias] = Array.isArray(v) ? v.map(x => project(x, e.sel)) : v ? project(v, e.sel) : null; });
  return out;
}
const get = (row, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row);
const same = (col, a, b) => (col.endsWith('username') && typeof a === 'string' && typeof b === 'string') ? a.toLowerCase() === b.toLowerCase() : String(a) === String(b);
const likeRe = p => new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');

/* ---------- query builder ---------- */
class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; this.op = 'select'; this.sel = parseSel('*'); }
  select(s = '*', opts = {}) { this.sel = parseSel(s); if (this.op === 'select') { this.countOpt = opts.count; this.head = opts.head; } else this.returning = true; return this; }
  insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this; }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.opts = opts; return this; }
  update(patch) { this.op = 'update'; this.patch = patch; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push(r => same(c, get(r, c), v)); return this; }
  neq(c, v) { this.filters.push(r => !same(c, get(r, c), v)); return this; }
  gt(c, v) { this.filters.push(r => get(r, c) > v); return this; }
  gte(c, v) { this.filters.push(r => get(r, c) >= v); return this; }
  lt(c, v) { this.filters.push(r => get(r, c) < v); return this; }
  in(c, vs) { this.filters.push(r => vs.some(v => same(c, get(r, c), v))); return this; }
  ilike(c, p) { const re = likeRe(p); this.filters.push(r => re.test(get(r, c) ?? '')); return this; }
  not(c, op, v) { if (op === 'is' && v === null) this.filters.push(r => get(r, c) != null); return this; }
  or(expr) {
    const parts = expr.split(',').map(p => { const [c, op, ...v] = p.split('.'); return { c, op, v: v.join('.') }; });
    this.filters.push(r => parts.some(({ c, op, v }) => op === 'ilike' ? likeRe(v).test(get(r, c) ?? '') : op === 'eq' ? same(c, get(r, c), v) : false));
    return this;
  }
  order(c, { ascending = true } = {}) { this.orders.push([c, ascending]); return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }

  match(rows) {
    let out = rows.map(r => expand(this.table, r, this.sel));
    out = out.filter(r => this.sel.embeds.every(e => !r['__inner_' + e.alias] || r[e.alias]) && this.filters.every(f => f(r)));
    for (const [c, asc] of [...this.orders].reverse()) {
      out.sort((a, b) => { const x = get(a, c), y = get(b, c); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); });
    }
    return out;
  }
  finish(rows) {
    if (this.head) return { data: null, count: rows.length, error: null };
    let data = rows.slice(0, this.lim ?? rows.length).map(r => project(r, this.sel));
    if (this.one) {
      if (data.length > 1 || (this.one === 'single' && !data.length)) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      data = data[0] || null;
    }
    return { data, count: this.countOpt ? rows.length : null, error: null };
  }
  run() {
    try {
      const T = this.table;
      if (this.op === 'select') return this.finish(this.match(view(T)));
      if (this.op === 'insert' || this.op === 'upsert') {
        const made = [];
        for (const raw of this.rows) {
          let row = defaults(T, raw);
          const clash = conflict(T, row, this.op === 'upsert' && this.opts?.onConflict);
          if (clash) {
            if (this.op === 'insert') return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
            if (this.opts?.ignoreDuplicates) continue;
            const before = { ...clash };
            Object.assign(clash, raw);
            onWrite(T, clash, before);
            made.push(clash);
          } else {
            check(T, row);
            onWrite(T, row, null);
            db[T].push(row);
            made.push(row);
          }
        }
        save();
        if (!this.returning) return { data: null, error: null };
        return this.finish(made.map(r => expand(T, r, this.sel)));
      }
      const hits = this.match(db[T]).map(r => db[T].find(x => x === r || (x.id && x.id === r.id) || sameKey(T, x, r)));
      if (this.op === 'update') {
        hits.forEach(r => { const before = { ...r }; Object.assign(r, guard(T, this.patch)); onWrite(T, r, before); });
        save();
        return this.returning ? this.finish(hits.map(r => expand(T, r, this.sel))) : { data: null, error: null };
      }
      if (this.op === 'delete') {
        hits.forEach(r => remove(T, r));
        save();
        return { data: null, error: null };
      }
    } catch (e) { return { data: null, error: { message: e.message, code: e.code || 'P0001' } }; }
  }
}
const sameKey = (T, a, b) => (UNIQUE[T] || []).some(cols => cols.every(c => a[c] === b[c]));
function conflict(T, row, onConflict) {
  const sets = onConflict ? [onConflict.split(',')] : UNIQUE[T] || [];
  return db[T].find(x => sets.some(cols => cols.every(c => x[c] != null && same(c, x[c], row[c]))) || (row.id && x.id === row.id));
}
function defaults(T, r) {
  const t = now();
  const base = {
    entries: { id: uuid(), rating: 0, date: null, platform: null, review: null, spoiler: false, reviewed_at: null, likes_count: 0, comments_count: 0, created_at: t, updated_at: t },
    lists: { id: uuid(), description: '', ranked: true, likes_count: 0, created_at: t, updated_at: t },
    comments: { id: uuid(), created_at: t }, follows: { created_at: t }, review_likes: { created_at: t }, list_likes: { created_at: t },
    favorites: { is_crown: false }
  }[T] || {};
  return { ...base, ...r };
}
// counters can only change through the triggers below, like the real database
function guard(T, patch) { const p = { ...patch }; if (T === 'entries' || T === 'lists') { delete p.likes_count; delete p.comments_count; } return p; }
function check(T, r) {
  const err = m => Object.assign(new Error(m), { code: '42501' });
  if (T === 'follows' && r.follower_id === r.following_id) throw err('cannot follow yourself');
  if (T === 'review_likes' && db.entries.find(e => e.id === r.entry_id)?.user_id === r.user_id) throw err('new row violates row-level security policy');
  if (T === 'list_likes' && db.lists.find(l => l.id === r.list_id)?.user_id === r.user_id) throw err('new row violates row-level security policy');
}
function onWrite(T, r, before) {
  if (T === 'entries') {
    r.review = (r.review || '').trim() || null;
    if (!r.review) r.reviewed_at = null;
    else if (!before || before.review !== r.review || !before.reviewed_at) r.reviewed_at = now();
    r.kind = db.titles.find(t => t.id === r.title_id)?.kind || r.kind;
    if (before && ['status', 'rating', 'date', 'platform', 'review', 'spoiler'].some(k => before[k] !== r[k])) r.updated_at = now();
    if (r.review && (!before || !before.review)) setTimeout(() => demoReact(r), 4000);
  }
  if (T === 'lists' && before) r.updated_at = r.updated_at || now();
  if (!before && T === 'review_likes') bump('entries', r.entry_id, 'likes_count', 1);
  if (!before && T === 'list_likes') bump('lists', r.list_id, 'likes_count', 1);
  if (!before && T === 'comments') bump('entries', r.entry_id, 'comments_count', 1);
}
function bump(T, id, col, d) { const x = db[T].find(r => r.id === id); if (x) x[col] = Math.max(0, x[col] + d); }
function remove(T, r) {
  db[T] = db[T].filter(x => x !== r);
  if (T === 'review_likes') bump('entries', r.entry_id, 'likes_count', -1);
  if (T === 'list_likes') bump('lists', r.list_id, 'likes_count', -1);
  if (T === 'comments') bump('entries', r.entry_id, 'comments_count', -1);
  if (T === 'entries') { db.review_likes = db.review_likes.filter(x => x.entry_id !== r.id); db.comments = db.comments.filter(x => x.entry_id !== r.id); }
  if (T === 'lists') { db.list_items = db.list_items.filter(x => x.list_id !== r.id); db.list_likes = db.list_likes.filter(x => x.list_id !== r.id); }
  if (T === 'profiles') {
    for (const t of ['entries', 'favorites', 'lists', 'review_likes', 'list_likes', 'comments']) db[t].filter(x => x.user_id === r.id).forEach(x => remove(t, x));
    db.follows = db.follows.filter(f => f.follower_id !== r.id && f.following_id !== r.id);
    db.users = db.users.filter(u => u.id !== r.id);
  }
}

// So the demo can show notifications: shortly after you write your first review on a title, a demo member likes it.
function demoReact(entry) {
  const fan = db.profiles.find(p => p.username === 'sara_x');
  if (!fan || fan.id === entry.user_id || !db.entries.includes(entry) || !entry.review) return;
  if (db.review_likes.some(l => l.user_id === fan.id && l.entry_id === entry.id)) return;
  db.review_likes.push({ user_id: fan.id, entry_id: entry.id, created_at: now() });
  bump('entries', entry.id, 'likes_count', 1);
  save();
}

/* ---------- auth ---------- */
const listeners = new Set();
let session = null;
try { const s = JSON.parse(localStorage.getItem(SESSION)); if (s && db.users.some(u => u.id === s.user.id)) session = s; } catch { }
const setSession = (s, event) => {
  session = s;
  try { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); } catch { }
  listeners.forEach(fn => fn(event, s));
};
const mkSession = u => ({ access_token: 'demo', user: { id: u.id, email: u.email } });

function newProfile(id, email, meta = {}) {
  let base = String(meta.username || email.split('@')[0]).replace(/[^A-Za-z0-9_]/g, '');
  if (base.length < 3) base += 'user';
  base = base.slice(0, 16);
  let uname = base;
  while (db.profiles.some(p => p.username.toLowerCase() === uname.toLowerCase())) uname = base + Math.floor(Math.random() * 9000 + 1000);
  db.profiles.push({ id, username: uname, display_name: String(meta.display_name || uname).slice(0, 40), bio: '', avatar_url: null, banner_url: null, created_at: now() });
}

const auth = {
  async getSession() { return { data: { session }, error: null }; },
  onAuthStateChange(fn) { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; },
  async signInWithPassword({ email, password }) {
    const u = db.users.find(x => x.email.toLowerCase() === String(email).toLowerCase() && x.password === password);
    if (!u) return { data: {}, error: { message: 'Invalid login credentials' } };
    const s = mkSession(u); setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null };
  },
  async signUp({ email, password, options = {} }) {
    if (db.users.some(x => x.email.toLowerCase() === String(email).toLowerCase())) return { data: {}, error: { message: 'User already registered' } };
    if (String(password).length < 6) return { data: {}, error: { message: 'Password should be at least 6 characters.' } };
    const u = { id: uuid(), email, password };
    db.users.push(u); newProfile(u.id, email, options.data); save();
    const s = mkSession(u); setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null };
  },
  async signOut() { setSession(null, 'SIGNED_OUT'); return { error: null }; },
  async resetPasswordForEmail() { return { data: {}, error: null }; },
  async signInWithOAuth() { return { data: {}, error: { message: 'Google غير متاح في النسخة التجريبية' } }; },
  async updateUser(attrs) {
    const u = session && db.users.find(x => x.id === session.user.id);
    if (!u) return { data: {}, error: { message: 'not signed in' } };
    if (attrs.password) u.password = attrs.password;
    if (attrs.email) { u.email = attrs.email; session.user.email = attrs.email; }
    save(); listeners.forEach(fn => fn('USER_UPDATED', session));
    return { data: { user: session.user }, error: null };
  }
};

/* ---------- storage: images become data URLs ---------- */
const storage = {
  from: () => ({
    async upload(path, blob) {
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      db.media = db.media || {}; db.media[path] = url; save();
      return { data: { path }, error: null };
    },
    getPublicUrl: path => ({ data: { publicUrl: db.media?.[path] || '' } })
  })
};

export const sb = {
  from: t => new Query(t),
  rpc: async (fn, args) => fn === 'username_available'
    ? { data: /^[A-Za-z0-9_]{3,20}$/.test(args.name) && !db.profiles.some(p => p.username.toLowerCase() === args.name.toLowerCase()), error: null }
    : { data: null, error: { message: 'unknown function' } },
  auth, storage,
  _putTitle(t) { if (!db.titles.some(x => x.id === t.id)) { db.titles.push({ id: t.id, kind: t.kind, title: t.title, year: t.year, poster: null, backdrop: null, by: t.by || null, genres: t.genres || [], platforms: t.platforms || [], sub: t.sub || null, about: null, updated_at: now() }); save(); } },
  _deleteMe() { const p = session && db.profiles.find(x => x.id === session.user.id); if (p) { remove('profiles', p); save(); } },
  _reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); } catch { } location.hash = '/'; location.reload(); }
};
export const configured = true;
export const googleEnabled = false;
export async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw error;
  return count != null && data == null ? count : data;
}
