// Notifications: likes on my reviews, new followers, comments on my reviews.
import { $, esc, ago } from '../lib/util.js';
import { sb, q } from '../lib/supabase.js';
import { me } from '../lib/store.js';
import { likesReceived, newFollowers, commentsReceived } from '../lib/db.js';
import { av, uname, cover, followBtn, loading, footer } from '../ui/components.js';
import { requireAuth } from '../ui/auth-gate.js';

const SEEN = 'raff-seen';
export const lastSeen = () => { try { return localStorage.getItem(SEEN) || '1970-01-01T00:00:00Z'; } catch { return '1970-01-01T00:00:00Z'; } };
const markSeen = () => { try { localStorage.setItem(SEEN, new Date().toISOString()); } catch { } };

// unread count for the bell badge
export async function unreadCount() {
  if (!me.user) return 0;
  const since = lastSeen(), id = me.user.id;
  const head = { count: 'exact', head: true };
  const [a, b, c] = await Promise.all([
    q(sb.from('review_likes').select('entry:entries!inner(user_id)', head).eq('entry.user_id', id).gt('created_at', since)),
    q(sb.from('follows').select('follower_id', head).eq('following_id', id).gt('created_at', since)),
    q(sb.from('comments').select('entry:entries!inner(user_id)', head).eq('entry.user_id', id).neq('user_id', id).gt('created_at', since))
  ]).catch(() => [0, 0, 0]);
  return (a || 0) + (b || 0) + (c || 0);
}

export async function activityPage(_, ctx) {
  if (!requireAuth()) return;
  document.getElementById('app').dataset.kind = 'movies';
  document.title = 'التنبيهات — رفّ';
  const since = lastSeen();
  $('view').innerHTML = `<div class="wrap page"><h1 class="ptitle">التنبيهات</h1><div class="nlist" id="nl">${loading()}</div>
    <p class="hint">تبي تشوف كل اللايكات اللي جتك واللي عطيتها؟ <a href="/u/${esc(me.profile.username)}/likes" data-link style="color:var(--accent)">صفحة اللايكات ‹</a></p></div>${footer()}`;
  const [likes, follows, comments] = await Promise.all([likesReceived(me.user.id, 60), newFollowers(me.user.id, 40), commentsReceived(me.user.id, 40)]);
  if (!ctx.alive()) return;
  const items = [
    ...likes.map(l => ({ at: l.created_at, html: `<a href="/u/${esc(l.user.username)}" data-link>${av(l.user, 36)}</a><div><p><a href="/u/${esc(l.user.username)}" data-link>${uname(l.user)}</a> ♥ عجبته مراجعتك على <a href="/r/${l.entry.id}" data-link>${esc(l.entry.title?.title)}</a></p><small>${ago(l.created_at)}</small></div><a href="/r/${l.entry.id}" data-link>${cover(l.entry.title)}</a>` })),
    ...follows.map(f => ({ at: f.created_at, html: `<a href="/u/${esc(f.user.username)}" data-link>${av(f.user, 36)}</a><div><p><a href="/u/${esc(f.user.username)}" data-link>${uname(f.user)}</a> صار يتابعك</p><small>${ago(f.created_at)}</small></div>${followBtn(f.user)}` })),
    ...comments.map(c => ({ at: c.created_at, html: `<a href="/u/${esc(c.user.username)}" data-link>${av(c.user, 36)}</a><div><p><a href="/u/${esc(c.user.username)}" data-link>${uname(c.user)}</a> علّق على مراجعتك لـ <a href="/r/${c.entry.id}" data-link>${esc(c.entry.title?.title)}</a>: «${esc(c.body.slice(0, 120))}»</p><small>${ago(c.created_at)}</small></div><a href="/r/${c.entry.id}" data-link>${cover(c.entry.title)}</a>` }))
  ].sort((a, b) => b.at.localeCompare(a.at));
  $('nl').innerHTML = items.length ? items.map(i => `<div class="nitem${new Date(i.at) > new Date(since) ? ' new' : ''}">${i.html}</div>`).join('') : '<div class="empty">ما فيه تنبيهات للحين. اكتب مراجعات وتابع ناس ويبدأ النشاط 🙂</div>';
  markSeen();
  document.dispatchEvent(new Event('raff-unread'));
}
