// The signed-in user and the bits of their data every page needs (what they logged, who they follow, what they liked).
import { sb, q } from './supabase.js';
import { ensureTitle } from './catalog.js';

export const me = {
  user: null,
  profile: null,
  entries: new Map(),   // title_id -> entry (without the joined title)
  following: new Set(), // profile ids
  liked: new Set(),     // entry ids of reviews I liked
  likedLists: new Set()
};
const subs = new Set();
export const onMe = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach(fn => fn(me));

export const signedIn = () => !!me.user;
export const isMe = id => !!me.user && me.user.id === id;

export async function loadMe(user) {
  me.user = user || null;
  me.profile = null; me.entries = new Map(); me.following = new Set(); me.liked = new Set(); me.likedLists = new Set();
  if (user) {
    const [profile, entries, following, liked, likedLists] = await Promise.all([
      q(sb.from('profiles').select('*').eq('id', user.id).single()),
      q(sb.from('entries').select('id,title_id,kind,status,rating,date,review,spoiler,platform').eq('user_id', user.id)),
      q(sb.from('follows').select('following_id').eq('follower_id', user.id)),
      q(sb.from('review_likes').select('entry_id').eq('user_id', user.id)),
      q(sb.from('list_likes').select('list_id').eq('user_id', user.id))
    ]);
    me.profile = profile;
    entries.forEach(e => me.entries.set(e.title_id, e));
    following.forEach(f => me.following.add(f.following_id));
    liked.forEach(l => me.liked.add(l.entry_id));
    likedLists.forEach(l => me.likedLists.add(l.list_id));
  }
  emit();
}
export function setProfile(p) { me.profile = { ...me.profile, ...p }; emit(); }

/* ---- entries ---- */
export async function saveEntry(titleId, fields) {
  await ensureTitle(titleId);
  const row = { user_id: me.user.id, title_id: titleId, kind: { g: 'games', m: 'movies', s: 'shows' }[titleId[0]], ...fields };
  const e = await q(sb.from('entries').upsert(row, { onConflict: 'user_id,title_id' }).select('id,title_id,kind,status,rating,date,review,spoiler,platform').single());
  me.entries.set(titleId, e);
  emit();
  return e;
}
export async function deleteEntry(titleId) {
  const e = me.entries.get(titleId); if (!e) return;
  await q(sb.from('entries').delete().eq('id', e.id));
  // favourites and list items of this title stay; only the log goes
  me.entries.delete(titleId);
  emit();
}

/* ---- social ---- */
export async function toggleFollow(profileId) {
  if (me.following.has(profileId)) {
    await q(sb.from('follows').delete().eq('follower_id', me.user.id).eq('following_id', profileId));
    me.following.delete(profileId);
  } else {
    await q(sb.from('follows').insert({ follower_id: me.user.id, following_id: profileId }));
    me.following.add(profileId);
  }
  emit();
  return me.following.has(profileId);
}
export async function toggleLike(entryId) {
  if (me.liked.has(entryId)) {
    await q(sb.from('review_likes').delete().eq('user_id', me.user.id).eq('entry_id', entryId));
    me.liked.delete(entryId);
  } else {
    await q(sb.from('review_likes').insert({ user_id: me.user.id, entry_id: entryId }));
    me.liked.add(entryId);
  }
  return me.liked.has(entryId);
}
export async function toggleListLike(listId) {
  if (me.likedLists.has(listId)) {
    await q(sb.from('list_likes').delete().eq('user_id', me.user.id).eq('list_id', listId));
    me.likedLists.delete(listId);
  } else {
    await q(sb.from('list_likes').insert({ user_id: me.user.id, list_id: listId }));
    me.likedLists.add(listId);
  }
  return me.likedLists.has(listId);
}
