// Shared HTML builders. Visual language is the same as the original page (covers, cards, sections).
import { esc, hue, stars, fmtDate, ago } from '../lib/util.js';
import { badge, label, KINDS } from '../lib/kinds.js';
import { me } from '../lib/store.js';

export const ICON = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.3 4.8 4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>'
};
export const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${ICON[k]}</svg>`;

/* ---- covers ---- */
// t is a title row ({id,title,poster,sub,...}); opts add the profile-specific pins
export function cover(t, { status, rank, crowned, tag, eager } = {}) {
  t = t || {};
  const h = hue(t.title);
  const img = t.poster ? `<img src="${esc(t.poster)}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" onerror="this.remove()">` : '';
  const pinTag = tag || (t.kind === 'shows' && t.sub === 'أنمي' ? 'أنمي' : '');
  return `<div class="cover${crowned ? ' crowned' : ''}${img ? ' has-img' : ''}" style="background-image:linear-gradient(160deg,hsl(${h} 55% 46%),hsl(${(h + 40) % 360} 55% 20%))">${img}
      <span class="pins">${badge(status)}${pinTag ? `<em class="tag">${esc(pinTag)}</em>` : ''}</span>
      ${rank ? `<em class="rank">${rank}</em>` : (crowned ? '<span class="crown" aria-label="تاج">👑</span>' : '')}
      <span dir="auto">${esc(t.title)}</span></div>`;
}
export const titleHref = t => `/t/${t.id}`;

// poster card linking to the title page; `entry` (optional) shows that user's status/rating underneath
export function card(t, { entry, rank, crowned, mine = true, caption = false, note } = {}) {
  let left = '', right = '';
  if (entry) {
    left = ['done', 'played', 'dropped'].includes(entry.status) && entry.date ? fmtDate(entry.date) : label(t.kind, entry.status, mine);
    right = stars(entry.rating);
  } else if (caption) {
    left = note ?? (t.year || '');
    const mineE = me.entries.get(t.id);
    right = mineE ? '<span class="have">عندك ✓</span>' : '';
  }
  return `<a class="card" href="${titleHref(t)}" data-link>${cover(t, { status: entry?.status, rank, crowned })}
    ${caption ? `<span class="cap" dir="auto" title="${esc(t.title)}">${esc(t.title)}</span>` : ''}
    ${left || right ? `<div class="meta"><span>${esc(left)}</span><span class="stars">${right}</span></div>` : ''}</a>`;
}
export const grid = (cards, empty, cls = '') => cards.length ? `<div class="posters ${cls}">${cards.join('')}</div>` : `<div class="empty">${empty}</div>`;
export const row = (cards, empty) => cards.length ? `<div class="row">${cards.join('')}</div>` : `<div class="empty">${empty}</div>`;
export const sh = (title, link = '') => `<div class="sh"><h2>${title}</h2>${link}</div>`;
export const skelRow = (n = 8) => `<div class="row">${Array.from({ length: n }, () => '<div class="cover skel"></div>').join('')}</div>`;

/* ---- people ---- */
export function av(p, size = 36) {
  const name = p?.display_name || p?.username || '?';
  const h = hue(p?.username || name);
  return `<span class="av s${size}" style="background:hsl(${h} 60% 62%)">${p?.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" loading="lazy">` : esc(name.trim().charAt(0).toUpperCase())}</span>`;
}
export const userHref = p => `/u/${encodeURIComponent(p.username)}`;
export const uname = p => esc(p?.display_name || p?.username || '');

export function followBtn(p) {
  if (me.user?.id === p.id) return ''; // visitors see it too; clicking sends them to log in
  const on = me.following.has(p.id);
  return `<button class="btn sm follow" type="button" data-follow="${esc(p.id)}" aria-pressed="${on}">${on ? 'تتابعه ✓' : '+ تابِع'}</button>`;
}
export function userRow(p, sub = '') {
  return `<div class="urow"><a href="${userHref(p)}" data-link>${av(p, 48)}</a>
    <div><b><a href="${userHref(p)}" data-link>${uname(p)}</a></b><small class="handle">@${esc(p.username)}</small>${sub ? `<small>${sub}</small>` : ''}</div>
    ${followBtn(p)}</div>`;
}

/* ---- reviews ---- */
export function likeBtn(e, big = false) {
  const on = me.liked.has(e.id), own = me.user && me.user.id === e.user_id;
  return `<button class="likebtn${big ? ' big' : ''}" type="button" data-like="${esc(e.id)}" aria-pressed="${on}" ${own ? 'disabled title="ما تقدر تعطي مراجعتك لايك"' : ''}>${svg('heart')}<span>${e.likes_count || 0}</span></button>`;
}
// e: entry with .user and .title joined
export function reviewCard(e, { showTitle = true, showUser = true, clamp = true } = {}) {
  const t = e.title || {};
  const body = `<p class="rbody${clamp ? ' clamp' : ''}${e.spoiler ? ' spoil' : ''}" ${e.spoiler ? 'data-spoil title="فيها حرق — اضغط عشان تشوف"' : ''}>${esc(e.review)}</p>`;
  return `<article class="rcard">
    ${showTitle ? `<a href="${titleHref(t)}" data-link>${cover(t)}</a>` : `<a href="${userHref(e.user)}" data-link>${av(e.user, 48)}</a>`}
    <div>
      <div class="rhead">${showUser && showTitle ? `<a class="u" href="${userHref(e.user)}" data-link>${av(e.user, 28)}${uname(e.user)}</a>` : ''}
        ${!showTitle ? `<a class="u" href="${userHref(e.user)}" data-link>${uname(e.user)}</a>` : ''}
        <span class="stars">${stars(e.rating)}</span>${e.spoiler ? '<span class="spoil-tag">فيها حرق</span>' : ''}<span>${ago(e.reviewed_at)}</span></div>
      ${showTitle ? `<h4><a href="${titleHref(t)}" data-link>${esc(t.title)}</a>${t.year ? ` <small style="color:var(--dim);font-weight:500">${t.year}</small>` : ''}</h4>` : ''}
      ${body}
      <div class="rfoot">${likeBtn(e)}<a href="/r/${e.id}" data-link>${svg('chat', 'ic')} ${e.comments_count || 0} تعليق</a><a href="/r/${e.id}" data-link>فتح المراجعة ‹</a></div>
    </div></article>`;
}
export const reviewList = (list, opts) => `<div class="revs">${list.map(e => reviewCard(e, opts)).join('')}</div>`;

/* ---- feed ---- */
const VERB = {
  games: { done: 'خلّص', played: 'لعب', playing: 'يلعب الحين', paused: 'وقّف', dropped: 'ترك', wish: 'حط في أمنياته' },
  movies: { done: 'شاف', played: 'شاف جزء من', playing: 'يشوف الحين', paused: 'وقّف', dropped: 'ترك', wish: 'يبي يشوف' },
  shows: { done: 'خلّص', played: 'تابع جزء من', playing: 'يتابع الحين', paused: 'وقّف', dropped: 'ترك', wish: 'يبي يتابع' }
};
export function feedItem(e) {
  const t = e.title || {};
  return `<div class="fitem"><a href="${userHref(e.user)}" data-link>${av(e.user, 36)}</a>
    <div><p><a href="${userHref(e.user)}" data-link>${uname(e.user)}</a> ${VERB[t.kind || e.kind]?.[e.status] || ''} <a href="${titleHref(t)}" data-link>${esc(t.title)}</a>
      ${e.rating ? ` <span class="stars">${stars(e.rating)}</span>` : ''}${e.review ? ` · <a href="/r/${e.id}" data-link style="font-weight:500;color:var(--mute)">كتب مراجعة</a>` : ''}</p>
      <small>${ago(e.updated_at)}</small></div>
    <a href="${titleHref(t)}" data-link>${cover(t)}</a></div>`;
}

/* ---- lists ---- */
export function listCard(l, { showUser = false } = {}) {
  const its = (l.list_items || []).slice().sort((a, b) => a.position - b.position).map(i => i.title).filter(Boolean);
  const K = KINDS[l.kind];
  return `<a class="lcard" href="/list/${l.id}" data-link>
    <div class="fan">${its.slice(0, 5).map(t => cover(t)).join('') || '<div class="empty" style="width:100%;padding:10px">فاضية</div>'}</div>
    <div><h3>${esc(l.title)}</h3><p>${its.length} ${K.unit}${l.likes_count ? ` · ♥ ${l.likes_count}` : ''}${showUser && l.user ? ` · ${uname(l.user)}` : ''}${l.description ? ' · ' + esc(l.description) : ''}</p></div></a>`;
}

export const loading = (t = 'يحمّل…') => `<div class="loading">${t}</div>`;
// TMDB and RAWG terms ask for a credit and a link somewhere on the site; this one line is it
export const footer = () => `<footer class="foot"><div class="wrap"><span>رفّ — رفّك لكل اللي لعبته وشفته</span>
  <span>البيانات: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a> · <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a></span></div></footer>`;
