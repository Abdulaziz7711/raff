// Read queries shared by pages. Everything here is public data (RLS allows anyone to read).
import { sb, q } from './supabase.js';
import { ensureTitle } from './catalog.js';
import { me } from './store.js';

export const T = 'id,kind,title,year,poster,backdrop,sub,genres,by';
export const U = 'id,username,display_name,avatar_url';
export const E = `*, title:titles(${T}), user:profiles!user_id(${U})`;

export const profileByName = name => q(sb.from('profiles').select('*').eq('username', name).maybeSingle()); // username is citext, so this ignores case
export const profileStats = id => q(sb.from('profile_stats').select('*').eq('id', id).maybeSingle());

export const userEntries = userId => q(sb.from('entries').select(`*, title:titles(${T})`).eq('user_id', userId).order('updated_at', { ascending: false }).limit(5000));
export const userFavorites = userId => q(sb.from('favorites').select(`*, title:titles(${T})`).eq('user_id', userId).order('position'));
export const userLists = userId => q(sb.from('lists').select(`*, list_items(position, title:titles(${T}))`).eq('user_id', userId).order('updated_at', { ascending: false }));

export const followers = id => q(sb.from('follows').select(`created_at, user:profiles!follows_follower_id_fkey(${U},bio)`).eq('following_id', id).order('created_at', { ascending: false }));
export const followingOf = id => q(sb.from('follows').select(`created_at, user:profiles!follows_following_id_fkey(${U},bio)`).eq('follower_id', id).order('created_at', { ascending: false }));

export function recentReviews({ kind, limit = 10, popular = false, userIds, since } = {}) {
  let r = sb.from('entries').select(E).not('review', 'is', null);
  if (kind) r = r.eq('kind', kind);
  if (userIds) r = r.in('user_id', userIds);
  if (since) r = r.gte('reviewed_at', since);
  r = popular ? r.order('likes_count', { ascending: false }).order('reviewed_at', { ascending: false }) : r.order('reviewed_at', { ascending: false });
  return q(r.limit(limit));
}
export function activity(userIds, limit = 40) {
  if (!userIds.length) return Promise.resolve([]);
  return q(sb.from('entries').select(E).in('user_id', userIds).order('updated_at', { ascending: false }).limit(limit));
}

/* ---- likes on my reviews / likes I gave ---- */
export const likesReceived = (userId, limit = 100) => q(sb.from('review_likes')
  .select(`created_at, user:profiles!user_id(${U}), entry:entries!inner(id,user_id,rating,review,likes_count, title:titles(${T}))`)
  .eq('entry.user_id', userId).order('created_at', { ascending: false }).limit(limit));
export const likesGiven = (userId, limit = 100) => q(sb.from('review_likes')
  .select(`created_at, entry:entries(id,user_id,rating,review,likes_count, title:titles(${T}), user:profiles!user_id(${U}))`)
  .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit));
export const commentsReceived = (userId, limit = 50) => q(sb.from('comments')
  .select(`id, body, created_at, user_id, user:profiles!user_id(${U}), entry:entries!inner(id,user_id, title:titles(${T}))`)
  .eq('entry.user_id', userId).neq('user_id', userId).order('created_at', { ascending: false }).limit(limit));
export const newFollowers = (userId, limit = 50) => q(sb.from('follows')
  .select(`created_at, user:profiles!follows_follower_id_fkey(${U})`).eq('following_id', userId).order('created_at', { ascending: false }).limit(limit));

/* ---- favourites: replace a whole kind at once (max 5, one crown) ---- */
export async function saveFavorites(kind, ids, crownId) {
  for (const id of ids) await ensureTitle(id);
  await q(sb.from('favorites').delete().eq('user_id', me.user.id).eq('kind', kind));
  if (ids.length) await q(sb.from('favorites').insert(ids.map((title_id, position) => ({ user_id: me.user.id, kind, position, title_id, is_crown: title_id === crownId }))));
}
export async function myFavorites(kind) {
  return q(sb.from('favorites').select(`*, title:titles(${T})`).eq('user_id', me.user.id).eq('kind', kind).order('position'));
}

/* ---- lists ---- */
export const getList = id => q(sb.from('lists').select(`*, user:profiles!user_id(${U}), list_items(position, title:titles(${T}))`).eq('id', id).maybeSingle());
export async function saveListOrder(listId, titleIds) {
  await q(sb.from('list_items').delete().eq('list_id', listId));
  if (titleIds.length) await q(sb.from('list_items').insert(titleIds.map((title_id, position) => ({ list_id: listId, title_id, position }))));
  await q(sb.from('lists').update({ updated_at: new Date().toISOString() }).eq('id', listId));
}
export async function addToList(listId, titleId) {
  await ensureTitle(titleId);
  const last = await q(sb.from('list_items').select('position').eq('list_id', listId).order('position', { ascending: false }).limit(1));
  await q(sb.from('list_items').upsert({ list_id: listId, title_id: titleId, position: (last[0]?.position ?? -1) + 1 }, { onConflict: 'list_id,title_id', ignoreDuplicates: true }));
  await q(sb.from('lists').update({ updated_at: new Date().toISOString() }).eq('id', listId));
}
export const myLists = kind => q(sb.from('lists').select('id,title,kind, list_items(title_id)').eq('user_id', me.user.id).eq('kind', kind).order('updated_at', { ascending: false }));
