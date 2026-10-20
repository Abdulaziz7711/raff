// Public profile page: the original layout (backdrop, head, folder tabs + tile deck, content + sidebar), for any member.
import { $, esc, YEAR, stars, ago, hue, toast } from '../lib/util.js';
import { KINDS, badge, label } from '../lib/kinds.js';
import { sb, q } from '../lib/supabase.js';
import { me, onMe, setProfile } from '../lib/store.js';
import * as db from '../lib/db.js';
import { navigate, reload, here } from '../lib/router.js';
import { card, cover, grid, sh, reviewList, listCard, userRow, followBtn, av, uname, footer, loading } from '../ui/components.js';
import { openModal } from '../ui/modal.js';
import { openSearch } from '../ui/searchModal.js';

const ICONS = {
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  library: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/>',
  wish: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  reviews: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  lists: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5l1 1 2-2M4 11l1 1 2-2M4 17l1 1 2-2"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.3 4.8 4"/>',
  likes: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
};
const VIEWS = ['profile', 'library', 'wish', 'reviews', 'lists', 'friends', 'likes'];

// fetched data for the profile being shown; dropped whenever my own data changes
let cache = null;
onMe(() => { cache = null; });
async function load(name) {
  if (cache && cache.name.toLowerCase() === name.toLowerCase() && Date.now() - cache.at < 60000) return cache;
  const p = await db.profileByName(name);
  if (!p) return null;
  const [entries, favs, lists, stats] = await Promise.all([db.userEntries(p.id), db.userFavorites(p.id), db.userLists(p.id), db.profileStats(p.id)]);
  cache = { name, at: Date.now(), p, entries, favs, lists, stats: stats || {} };
  return cache;
}
export const invalidateProfile = () => { cache = null; };

let libFilter = 'done', libQ = '';
const getKind = () => { const k = new URLSearchParams(here().search).get('k'); if (KINDS[k]) return k; try { return localStorage.getItem('shelf-kind') || 'games'; } catch { return 'games'; } };

export async function profilePage({ name, view = 'profile' }, ctx) {
  if (!VIEWS.includes(view)) view = 'profile';
  let kind = getKind(); if (!KINDS[kind]) kind = 'games';
  if (!cache || cache.name.toLowerCase() !== name.toLowerCase()) $('view').innerHTML = loading();
  const d = await load(name);
  if (!ctx.alive()) return;
  if (!d) { $('view').innerHTML = `<div class="wrap page"><div class="empty">ما فيه عضو بهالاسم: @${esc(name)}</div></div>`; return; }
  const { p, entries, favs, lists, stats } = d;
  const own = me.user?.id === p.id;
  const K = KINDS[kind];
  const mine = entries.filter(e => e.kind === kind && e.title);
  const byDate = arr => [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updated_at || '').localeCompare(a.updated_at || ''));
  const base = `/u/${encodeURIComponent(p.username)}`;
  const href = (v, extra = '') => `${base}${v === 'profile' ? '' : '/' + v}?k=${kind}${extra}`;
  const ecard = e => card(e.title, { entry: e, mine: own });
  document.getElementById('app').dataset.kind = kind;
  document.title = `${p.display_name || p.username} — رفّ`;

  /* ---------- views ---------- */
  function sidebar() {
    const rated = mine.filter(i => +i.rating > 0), counts = Array(10).fill(0);
    rated.forEach(i => counts[Math.round(i.rating * 2) - 1]++);
    const max = Math.max(1, ...counts);
    const playing = byDate(mine.filter(i => i.status === 'playing'));
    return `<aside>
      ${playing.length ? `<section>${sh(label(kind, 'playing', own))}${grid(playing.map(ecard), '')}</section>` : ''}
      <section>${sh(`التقييمات · ${rated.length}`)}
        <div class="hist">${counts.map((c, ix) => `<i style="height:${Math.max(4, c / max * 100)}%" title="${(ix + 1) / 2}★: ${c}"></i>`).join('')}</div>
        <div class="hist-l"><span>½</span><span>★★★★★</span></div>
      </section>
    </aside>`;
  }
  function vProfile() {
    const fav = favs.filter(f => f.kind === kind && f.title);
    const ent = new Map(entries.map(e => [e.title_id, e]));
    const recent = byDate(mine.filter(i => i.status === 'done' && (i.date || '').startsWith(YEAR)));
    const paused = byDate(mine.filter(i => i.status === 'paused'));
    const revs = mine.filter(i => i.review).sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || '')).slice(0, 3).map(e => ({ ...e, user: p }));
    return `<main>
      <section>${sh('المفضلة', own ? '<button type="button" data-editfav>تعديل ‹</button>' : '')}${grid(fav.map(f => card(f.title, { entry: ent.get(f.title_id), crowned: f.is_crown, mine: own })), own ? 'اختار مفضلاتك من «تعديل الملف»' : 'ما اختار مفضلات للحين.', 'fav')}</section>
      <section>${sh('آخر نشاط')}${grid(recent.slice(0, 12).map(ecard), own ? `أي ${K.unit} تخلصها وتحط تاريخها في ${YEAR} تطلع هنا.` : `ما خلّص شي في ${YEAR} للحين.`)}</section>
      <section>${sh(own ? K.back : 'موقّفها')}${grid(paused.map(ecard), 'ولا شي موقّف 👌')}</section>
      <section>${sh('آخر المراجعات', revs.length ? `<a href="${href('reviews')}" data-link data-keep>الكل ‹</a>` : '')}${revs.length ? reviewList(revs, { showUser: false }) : `<div class="empty">${own ? `اكتب مراجعة لأي ${K.unit} وتطلع هنا.` : 'ما كتب مراجعات للحين.'}</div>`}</section>
    </main>${sidebar()}`;
  }
  const libList = () => byDate(mine.filter(i => i.status === libFilter && (!libQ || i.title.title.toLowerCase().includes(libQ.toLowerCase()))));
  const libEmpty = () => libQ ? 'ما لقيت شي بهالاسم' : `ما فيه شي في «${label(kind, libFilter, own)}»`;
  function vLibrary() {
    const chip = s => `<button class="chip" data-f="${s}" type="button" aria-pressed="${libFilter === s}">${label(kind, s, own)} · ${mine.filter(i => i.status === s).length}</button>`;
    return `<main class="full"><section><div class="toolbar"><h2>${K.name}</h2></div>
      <div class="chips">${['done', 'played', 'playing', 'paused', 'dropped'].map(chip).join('')}</div>
      <div class="legend">${['done', 'played', 'dropped'].map(s => `<span>${badge(s)}${label(kind, s, own)}</span>`).join('')}</div>
      <label class="lsearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input id="libQ" type="search" placeholder="دوّر في ${esc(label(kind, libFilter, own))}…" value="${esc(libQ)}" autocomplete="off"></label>
      <div id="libGrid">${grid(libList().map(ecard), libEmpty())}</div></section></main>`;
  }
  function vWish() {
    const list = byDate(mine.filter(i => i.status === 'wish'));
    return `<main class="full"><section>
      <div class="toolbar"><h2>${K.list} · ${list.length}</h2>${own ? '<button class="btn primary" data-search type="button">+ ابحث وأضف</button>' : ''}</div>
      ${grid(list.map(ecard), `ما فيه شي في ${K.list}.`)}</section></main>`;
  }
  function vReviews() {
    const list = mine.filter(i => i.review).sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || '')).map(e => ({ ...e, user: p }));
    return `<main>${sh(`المراجعات · ${list.length}`)}${list.length ? reviewList(list, { showUser: false }) : `<div class="empty">${own ? 'اكتب مراجعة لأي عنصر من نافذة التسجيل، وتطلع هنا وفي الملف.' : 'ما كتب مراجعات للحين.'}</div>`}</main>${sidebar()}`;
  }
  function vLists() {
    const ls = lists.filter(l => l.kind === kind);
    const genres = [...new Set(mine.flatMap(i => i.title.genres || []))].slice(0, 3);
    const ideas = [`أفضل ${K.best} ${YEAR}`, ...genres.map(g => `أفضل ${K.best} ${g}`), `أفضل ${K.best} على الإطلاق`];
    return `<main class="full"><section>
      <div class="toolbar"><h2>القوائم · ${ls.length}</h2>${own ? '<button class="btn primary" type="button" data-newlist="">+ قائمة جديدة</button>' : ''}</div>
      ${own ? `<div class="ideas"><small>أفكار:</small>${ideas.map(t => `<button class="chip" type="button" data-newlist="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      ${ls.length ? `<div class="lists">${ls.map(l => listCard(l)).join('')}</div>` : `<div class="empty">${own ? 'سوّ أول قائمة لك، مثلاً «أفضل ألعاب السنة».' : 'ما سوّى قوائم للحين.'}</div>`}
    </section></main>`;
  }
  function vFriends() {
    const tab = new URLSearchParams(here().search).get('tab') === 'followers' ? 'followers' : 'following';
    return `<main class="full"><section>
      <div class="toolbar"><h2>الأصدقاء</h2>${own ? '<a class="btn primary" href="/members" data-link>+ دوّر أعضاء</a>' : ''}</div>
      <div class="chips"><a class="chip" href="${href('friends', '&tab=following')}" data-link data-keep aria-pressed="${tab === 'following'}">${own ? 'أتابعهم' : 'يتابعهم'} · ${stats.following || 0}</a>
        <a class="chip" href="${href('friends', '&tab=followers')}" data-link data-keep aria-pressed="${tab === 'followers'}">${own ? 'يتابعوني' : 'متابعينه'} · ${stats.followers || 0}</a></div>
      <div id="ppl">${loading()}</div></section></main>`;
  }
  function vLikes() {
    const tab = new URLSearchParams(here().search).get('tab') === 'given' ? 'given' : 'received';
    return `<main class="full"><section>
      <div class="toolbar"><h2>اللايكات</h2></div>
      <div class="big-n"><div><b>${stats.likes_received || 0}</b><span>لايك ${own ? 'جاني' : 'جاه'} على المراجعات</span></div><div><b id="givenN">…</b><span>لايك ${own ? 'عطيته' : 'عطاه'}</span></div></div>
      <div class="chips" style="margin-top:16px"><a class="chip" href="${href('likes', '&tab=received')}" data-link data-keep aria-pressed="${tab === 'received'}">${own ? 'جاتني' : 'جاته'}</a>
        <a class="chip" href="${href('likes', '&tab=given')}" data-link data-keep aria-pressed="${tab === 'given'}">${own ? 'عطيتها' : 'عطاها'}</a></div>
      <div id="likesBox">${loading()}</div></section></main>`;
  }

  /* ---------- head + deck ---------- */
  const tiles = [
    ['profile', 'الملف', ''],
    ['library', K.name, mine.filter(i => i.status !== 'wish').length],
    ['wish', K.short, mine.filter(i => i.status === 'wish').length],
    ['reviews', 'المراجعات', mine.filter(i => i.review).length],
    ['lists', 'القوائم', lists.filter(l => l.kind === kind).length],
    ['friends', 'الأصدقاء', stats.following || 0],
    ['likes', 'اللايكات', stats.likes_received || 0]
  ];
  const done = mine.filter(i => i.status === 'done'), played = mine.filter(i => i.status !== 'wish');
  const st = [[played.length, own ? K.total : 'المجموع'], [done.filter(i => (i.date || '').startsWith(YEAR)).length, 'في ' + YEAR], [mine.filter(i => i.status === 'paused').length, own ? K.paused : 'موقّفها'], [mine.filter(i => i.status === 'wish').length, K.short]];
  const M = { profile: vProfile, library: vLibrary, wish: vWish, reviews: vReviews, lists: vLists, friends: vFriends, likes: vLikes };
  const h = hue(p.username);

  $('view').innerHTML = `
    <div class="backdrop">${p.banner_url ? `<img src="${esc(p.banner_url)}" alt="">` : ''}${own ? '<button class="bd-btn" type="button" data-editprof>تغيير الخلفية</button>' : ''}</div>
    <div class="wrap">
      <section class="head">
        <div class="avatar" style="${p.avatar_url ? '' : `background:hsl(${h} 60% 62%)`}">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="">` : esc((p.display_name || p.username).trim().charAt(0).toUpperCase())}</div>
        <div class="idt">
          <div class="idt-top"><h1>${esc(p.display_name || p.username)}</h1>${own ? '<button class="edit" type="button" data-editprof>تعديل الملف</button>' : followBtn(p)}</div>
          <span class="handle">@${esc(p.username)}</span>
          ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
          <div class="fcounts"><a href="${href('friends', '&tab=followers')}" data-link data-keep><b>${stats.followers || 0}</b> متابع</a><a href="${href('friends', '&tab=following')}" data-link data-keep><b>${stats.following || 0}</b> يتابع</a><a href="${href('likes')}" data-link data-keep><b>${stats.likes_received || 0}</b> لايك</a></div>
        </div>
        <div class="stats">${st.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
      </section>
      <div class="drawer">
        <div class="folders" role="group" aria-label="نوع المحتوى">
          ${['games', 'movies', 'shows'].map(k => `<button data-k="${k}" type="button" aria-pressed="${k === kind}"><i></i>${{ games: 'ألعاب', movies: 'أفلام', shows: 'مسلسلات وأنمي' }[k]}</button>`).join('')}
        </div>
        <nav class="deck">${tiles.map(([v, l, n]) => `<a class="tile" href="${href(v)}" data-link data-keep aria-current="${view === v}">
          <span class="tile-top"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[v]}</svg><b>${n}</b></span><span>${esc(l)}</span></a>`).join('')}</nav>
      </div>
      <div class="layout" id="layout">${M[view]()}</div>
    </div>${footer()}`;

  /* ---------- async parts ---------- */
  if (view === 'friends') {
    const tab = new URLSearchParams(here().search).get('tab') === 'followers' ? 'followers' : 'following';
    const list = await (tab === 'followers' ? db.followers(p.id) : db.followingOf(p.id));
    if (!ctx.alive()) return;
    $('ppl').innerHTML = list.length ? `<div class="ulist">${list.map(x => userRow(x.user, esc(x.user.bio || ''))).join('')}</div>` : `<div class="empty">${tab === 'followers' ? 'ما أحد يتابع للحين.' : 'ما يتابع أحد للحين.'}</div>`;
  }
  if (view === 'likes') {
    const tab = new URLSearchParams(here().search).get('tab') === 'given' ? 'given' : 'received';
    q(sb.from('review_likes').select('user_id', { count: 'exact', head: true }).eq('user_id', p.id)).then(n => { if ($('givenN')) $('givenN').textContent = n; });
    if (tab === 'received') {
      const list = await db.likesReceived(p.id);
      if (!ctx.alive()) return;
      $('likesBox').innerHTML = list.length ? `<div class="nlist">${list.map(l => `<div class="nitem"><a href="/u/${esc(l.user.username)}" data-link>${av(l.user, 36)}</a>
        <div><p><a href="/u/${esc(l.user.username)}" data-link>${uname(l.user)}</a> عجبته ${own ? 'مراجعتك' : 'مراجعته'} على <a href="/r/${l.entry.id}" data-link>${esc(l.entry.title?.title)}</a></p><small>${ago(l.created_at)} · ♥ ${l.entry.likes_count} على هالمراجعة</small></div>
        <a href="/t/${l.entry.title?.id}" data-link>${cover(l.entry.title)}</a></div>`).join('')}</div>` : '<div class="empty">ما جا لايك للحين.</div>';
    } else {
      const list = await db.likesGiven(p.id);
      if (!ctx.alive()) return;
      const revs = list.map(l => l.entry).filter(e => e && e.review);
      $('likesBox').innerHTML = revs.length ? reviewList(revs) : '<div class="empty">ما عطى لايك لأي مراجعة للحين.</div>';
    }
  }

  /* ---------- events ---------- */
  const root = $('view');
  root.querySelector('.folders').onclick = e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    try { localStorage.setItem('shelf-kind', b.dataset.k); } catch { }
    libFilter = 'done'; libQ = '';
    navigate(`${base}${view === 'profile' ? '' : '/' + view}?k=${b.dataset.k}`, { replace: true, keepScroll: true });
  };
  root.querySelectorAll('[data-editprof],[data-editfav]').forEach(b => b.onclick = () => editProfile(d, kind));
  root.querySelector('[data-search]')?.addEventListener('click', () => openSearch({ kind }));
  root.querySelectorAll('[data-newlist]').forEach(b => b.onclick = () => newList(kind, b.dataset.newlist));
  root.querySelectorAll('.chip[data-f]').forEach(b => b.onclick = () => { libFilter = b.dataset.f; $('layout').innerHTML = vLibrary(); bindLib(); });
  const bindLib = () => {
    $('layout').querySelectorAll('.chip[data-f]').forEach(b => b.onclick = () => { libFilter = b.dataset.f; $('layout').innerHTML = vLibrary(); bindLib(); });
    $('libQ')?.addEventListener('input', e => { libQ = e.target.value; $('libGrid').innerHTML = grid(libList().map(ecard), libEmpty()); });
  };
  if (view === 'library') bindLib();
}

/* ---------- new list ---------- */
function newList(kind, preset = '') {
  const { el, close } = openModal(`<h3>قائمة جديدة</h3>
    <label class="f">اسم القائمة<input name="title" required maxlength="60" value="${esc(preset)}" autofocus></label>
    <label class="f">وصف (اختياري)<textarea name="description" maxlength="300" style="min-height:60px"></textarea></label>
    <label class="check"><input type="checkbox" name="ranked" checked> قائمة مرتّبة (بأرقام)</label>
    <div class="m-actions"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">سوّها</button></span></div>`, { form: true });
  el.onsubmit = async e => {
    e.preventDefault();
    const title = el.title.value.trim(); if (!title) return;
    try {
      const l = await q(sb.from('lists').insert({ user_id: me.user.id, kind, title, description: el.description.value.trim(), ranked: el.ranked.checked }).select('id').single());
      cache = null; close(); navigate(`/list/${l.id}`);
    } catch { toast('ما انحفظت، جرّب مرة ثانية'); }
  };
}

/* ---------- edit profile + favourites editor (same UI as before) ---------- */
function resizeImage(file, maxW) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const scale = Math.min(1, maxW / im.width);
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b) : rej(new Error('image')), 'image/jpeg', 0.85);
      URL.revokeObjectURL(im.src);
    };
    im.onerror = rej;
    im.src = URL.createObjectURL(file);
  });
}
async function upload(blob, name) {
  const path = `${me.user.id}/${name}-${Date.now()}.jpg`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

function editProfile(d, kind) {
  const p = d.p;
  let feKind = kind, banner = undefined, avatar = undefined, bannerBlob = null, avatarBlob = null, feDrag = null;
  const fe = {}, crown = {};
  ['games', 'movies', 'shows'].forEach(k => {
    const fs = d.favs.filter(f => f.kind === k).sort((a, b) => a.position - b.position);
    fe[k] = fs.map(f => f.title_id); crown[k] = fs.find(f => f.is_crown)?.title_id;
  });
  const orig = JSON.stringify([fe, crown]);
  const titleOf = id => d.entries.find(e => e.title_id === id)?.title || d.favs.find(f => f.title_id === id)?.title;
  const { el, close } = openModal(`<h3>تعديل الملف</h3>
    <label class="f">الاسم<input name="display_name" required maxlength="40" value="${esc(p.display_name)}"></label>
    <label class="f">النبذة<textarea name="bio" maxlength="200">${esc(p.bio)}</textarea></label>
    <div class="f">الصورة الشخصية
      <div class="bn-row" style="align-items:center"><span class="avatar" data-avprev style="width:56px;height:56px;font-size:22px;box-shadow:none"></span>
      <label class="btn" style="cursor:pointer">اختر صورة<input type="file" data-avfile accept="image/*" hidden></label><button type="button" class="btn" data-avdel>إزالة</button></div>
    </div>
    <div class="f">صورة الخلفية
      <div class="bn-prev" data-bnprev></div>
      <div class="bn-row"><label class="btn" style="cursor:pointer">اختر صورة<input type="file" data-bnfile accept="image/*" hidden></label><button type="button" class="btn" data-bndel>إزالة</button></div>
    </div>
    <div class="f">المفضلة <span class="hint">اسحبها أو حرّكها بالأسهم، واضغط 👑 عشان تحط التاج</span>
      <div class="fe-kinds chips" data-fek style="margin:4px 0 6px"></div>
      <div class="fe-row" data-ferow></div>
    </div>
    <p class="err" data-err hidden></p>
    <div class="m-actions"><span></span><span style="display:flex;gap:8px"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">حفظ</button></span></div>`, { form: true, width: 580 });
  const $e = s => el.querySelector(s);
  const showAv = src => { const a = $e('[data-avprev]'); a.style.background = src ? '' : `hsl(${hue(p.username)} 60% 62%)`; a.innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc((p.display_name || p.username).charAt(0).toUpperCase()); };
  const showBn = src => { $e('[data-bnprev]').style.backgroundImage = src ? `url("${src}")` : ''; };
  showAv(p.avatar_url); showBn(p.banner_url);
  $e('[data-avfile]').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; avatarBlob = await resizeImage(f, 400); avatar = URL.createObjectURL(avatarBlob); showAv(avatar); };
  $e('[data-bnfile]').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; bannerBlob = await resizeImage(f, 1800); banner = URL.createObjectURL(bannerBlob); showBn(banner); };
  $e('[data-avdel]').onclick = () => { avatar = null; avatarBlob = null; showAv(''); };
  $e('[data-bndel]').onclick = () => { banner = null; bannerBlob = null; showBn(''); };

  function renderFE() {
    $e('[data-fek]').innerHTML = ['games', 'movies', 'shows'].map(k => `<button class="chip" type="button" data-k="${k}" aria-pressed="${feKind === k}">${{ games: 'ألعاب', movies: 'أفلام', shows: 'مسلسلات وأنمي' }[k]}</button>`).join('');
    const ids = fe[feKind];
    $e('[data-ferow]').innerHTML = [0, 1, 2, 3, 4].map(ix => {
      const t = ids[ix] && titleOf(ids[ix]);
      if (!t) return `<button class="slot-empty" type="button" data-slot="${ix}" aria-label="أضف">+</button>`;
      return `<div class="slot" draggable="true" data-ix="${ix}">${cover(t)}
        <div class="sctl"><button type="button" data-fm="-1" data-ix="${ix}" ${ix === 0 ? 'disabled' : ''} aria-label="يمين">▶</button><button type="button" data-crown="${ix}" aria-pressed="${crown[feKind] === t.id}" aria-label="تاج">👑</button><button type="button" data-fm="1" data-ix="${ix}" ${ix === ids.length - 1 ? 'disabled' : ''} aria-label="يسار">◀</button></div>
        <div class="sctl"><button type="button" data-slot="${ix}">تغيير</button><button type="button" data-frm="${ix}">شيل</button></div></div>`;
    }).join('');
  }
  renderFE();
  $e('[data-fek]').onclick = ev => { const b = ev.target.closest('[data-k]'); if (b) { feKind = b.dataset.k; renderFE(); } };
  const row = $e('[data-ferow]');
  row.onclick = ev => {
    const ids = fe[feKind], t = ev.target;
    const sl = t.closest('[data-slot]'); if (sl) return pick(+sl.dataset.slot);
    const m = t.closest('[data-fm]'); if (m) { const a = +m.dataset.ix, b = a + (+m.dataset.fm); [ids[a], ids[b]] = [ids[b], ids[a]]; return renderFE(); }
    const c = t.closest('[data-crown]'); if (c) { const id = ids[+c.dataset.crown]; crown[feKind] = crown[feKind] === id ? undefined : id; return renderFE(); }
    const r = t.closest('[data-frm]'); if (r) { const id = ids.splice(+r.dataset.frm, 1)[0]; if (crown[feKind] === id) crown[feKind] = undefined; renderFE(); }
  };
  row.addEventListener('dragstart', ev => { const s = ev.target.closest('.slot'); if (!s) return; feDrag = +s.dataset.ix; s.classList.add('drag'); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', String(feDrag)); } catch { } });
  row.addEventListener('dragover', ev => { const s = ev.target.closest('.slot'); if (s && feDrag !== null) { ev.preventDefault(); row.querySelectorAll('.slot.over').forEach(x => x.classList.remove('over')); s.classList.add('over'); } });
  row.addEventListener('drop', ev => { const s = ev.target.closest('.slot'); if (!s || feDrag === null) return; ev.preventDefault(); const ids = fe[feKind]; const [m] = ids.splice(feDrag, 1); ids.splice(+s.dataset.ix, 0, m); feDrag = null; renderFE(); });
  row.addEventListener('dragend', () => { feDrag = null; row.querySelectorAll('.slot').forEach(x => x.classList.remove('drag', 'over')); });

  function pick(slot) {
    const pool = d.entries.filter(e => e.kind === feKind && e.status !== 'wish' && e.title).sort((a, b) => a.title.title.localeCompare(b.title.title));
    const { el: pe, close: pclose } = openModal(`<h3>اختار من ${KINDS[feKind].name}</h3>
      <label class="lsearch" style="max-width:none;margin:0"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input type="search" placeholder="دوّر…" autocomplete="off" autofocus></label>
      <div class="pick-grid"></div>
      <div class="m-actions"><span></span><button type="button" class="btn" data-close>رجوع</button></div>`, { width: 560 });
    const draw = () => {
      const qv = pe.querySelector('input').value.trim().toLowerCase();
      const list = pool.filter(e => !qv || e.title.title.toLowerCase().includes(qv));
      pe.querySelector('.pick-grid').innerHTML = list.length ? list.map(e => `<button class="card" type="button" data-pk="${esc(e.title_id)}" ${fe[feKind].includes(e.title_id) ? 'disabled' : ''}>${cover(e.title)}<div class="meta"><span>${esc(KINDS[e.kind][e.status])}</span><span class="stars">${stars(e.rating)}</span></div></button>`).join('')
        : `<div class="sstate" style="grid-column:1/-1">${qv ? 'ما لقيت شي بهالاسم' : 'ما سجّلت شي هنا للحين. ابحث من فوق وسجّل.'}</div>`;
    };
    draw();
    pe.querySelector('input').oninput = draw;
    pe.querySelector('.pick-grid').onclick = ev => {
      const b = ev.target.closest('[data-pk]'); if (!b || b.disabled) return;
      const ids = fe[feKind];
      if (slot < ids.length) { if (crown[feKind] === ids[slot]) crown[feKind] = undefined; ids[slot] = b.dataset.pk; } else ids.push(b.dataset.pk);
      pclose(); renderFE();
    };
  }

  el.onsubmit = async ev => {
    ev.preventDefault();
    const btn = $e('.btn.primary'); btn.disabled = true;
    const err = $e('[data-err]'); err.hidden = true;
    try {
      const patch = { display_name: el.display_name.value.trim() || p.username, bio: el.bio.value.trim() };
      if (avatarBlob) patch.avatar_url = await upload(avatarBlob, 'avatar'); else if (avatar === null) patch.avatar_url = null;
      if (bannerBlob) patch.banner_url = await upload(bannerBlob, 'banner'); else if (banner === null) patch.banner_url = null;
      await q(sb.from('profiles').update(patch).eq('id', p.id));
      if (JSON.stringify([fe, crown]) !== orig) for (const k of ['games', 'movies', 'shows']) await db.saveFavorites(k, fe[k], crown[k]);
      setProfile(patch); cache = null; close(); toast('انحفظ ✓'); reload();
    } catch (x) { console.error(x); err.textContent = 'ما انحفظ، جرّب مرة ثانية.'; err.hidden = false; btn.disabled = false; }
  };
}
