// Explore (trending / popular / top / upcoming from RAWG & TMDB), full search, and the members directory.
import { $, esc, qsGet } from '../lib/util.js';
import { KINDS, KIND_NAME } from '../lib/kinds.js';
import { discover, search } from '../lib/catalog.js';
import { sb, q } from '../lib/supabase.js';
import { U } from '../lib/db.js';
import { card, grid, userRow, loading, footer } from '../ui/components.js';
import { navigate } from '../lib/router.js';

const FEEDS = { trending: 'الرائج', popular: 'الأشهر', top: 'الأعلى تقييماً', upcoming: 'قريباً' };

export async function explorePage({ kind = 'games' }, ctx) {
  if (!KINDS[kind]) kind = 'games';
  const feeds = kind === 'shows' ? { ...FEEDS, upcoming: 'يُعرض الحين', anime: 'أنمي' } : FEEDS;
  let feed = qsGet('feed'); if (!feeds[feed]) feed = 'trending';
  document.getElementById('app').dataset.kind = kind;
  document.title = `استكشف ${KINDS[kind].name} — رفّ`;
  $('view').innerHTML = `<div class="wrap page">
    <div><h1 class="ptitle">استكشف</h1></div>
    <div class="folders" style="padding-inline-start:0">${Object.keys(KINDS).map(k => `<a class="chip" href="/explore/${k}" data-link aria-pressed="${k === kind}" style="font-weight:700">${KIND_NAME[k]}</a>`).join('')}</div>
    <div class="chips" style="margin:-16px 0 0">${Object.entries(feeds).map(([f, l]) => `<a class="chip" href="/explore/${kind}?feed=${f}" data-link data-keep aria-pressed="${f === feed}">${l}</a>`).join('')}</div>
    <div id="grid">${loading()}</div>
    <button class="btn more" type="button" id="more" hidden>حمّل أكثر</button>
  </div>${footer()}`;
  let page = 1; const all = [];
  async function more() {
    $('more').disabled = true;
    try {
      const list = await discover(kind, feed, page);
      if (!ctx.alive()) return;
      const seen = new Set(all.map(t => t.id));
      all.push(...list.filter(t => !seen.has(t.id)));
      $('grid').innerHTML = grid(all.map(t => card(t, { caption: true })), 'ما فيه شي هنا.');
      $('more').hidden = list.length < 10 || page >= 20; page++;
    } catch { if (ctx.alive()) $('grid').innerHTML = '<div class="empty">ما قدرنا نجيب القائمة الحين، جرّب بعد شوي.</div>'; }
    $('more').disabled = false;
  }
  $('more').onclick = more;
  more();
}

export async function searchPage(_, ctx) {
  const qv = (qsGet('q') || '').trim();
  let tab = qsGet('k'); if (!['games', 'movies', 'shows', 'users'].includes(tab)) tab = 'games';
  document.getElementById('app').dataset.kind = KINDS[tab] ? tab : 'games';
  const tabs = { games: 'ألعاب', movies: 'أفلام', shows: 'مسلسلات وأنمي', users: 'أعضاء' };
  $('view').innerHTML = `<div class="wrap page">
    <form class="sbar" id="pq" role="search"><input name="q" value="${esc(qv)}" placeholder="ابحث عن لعبة، فيلم، مسلسل، أو عضو…" autocomplete="off" enterkeyhint="search" ${qv ? '' : 'autofocus'}><button class="btn primary">بحث</button></form>
    <div class="chips" style="margin:0">${Object.entries(tabs).map(([k, l]) => `<a class="chip" href="/search?q=${encodeURIComponent(qv)}&k=${k}" data-link data-keep aria-pressed="${k === tab}">${l}</a>`).join('')}</div>
    <div id="res">${qv ? loading('يدوّر…') : '<div class="empty">اكتب اللي تدوّر عليه.</div>'}</div></div>${footer()}`;
  $('pq').onsubmit = e => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(e.target.q.value.trim())}&k=${tab}`); };
  if (!qv) return;
  try {
    if (tab === 'users') {
      const like = `%${qv.replace(/[,()"'\\%_*]/g, ' ').trim()}%`; // keep PostgREST's or() syntax intact
      const list = await q(sb.from('profiles').select(U + ',bio').or(`username.ilike.${like},display_name.ilike.${like}`).limit(40));
      if (!ctx.alive()) return;
      $('res').innerHTML = list.length ? `<div class="ulist">${list.map(p => userRow(p, esc(p.bio || ''))).join('')}</div>` : '<div class="empty">ما لقينا أحد بهالاسم.</div>';
    } else {
      const list = await search(tab, qv);
      if (!ctx.alive()) return;
      $('res').innerHTML = grid(list.map(t => card(t, { caption: true })), 'ما لقيت شي بهالاسم. جرّب تكتبه بطريقة ثانية أو بالإنجليزي.');
    }
  } catch { if (ctx.alive()) $('res').innerHTML = '<div class="empty">صار خطأ في البحث، جرّب مرة ثانية.</div>'; }
}

export async function membersPage(_, ctx) {
  document.getElementById('app').dataset.kind = 'shows';
  document.title = 'الأعضاء — رفّ';
  $('view').innerHTML = `<div class="wrap page">
    <div class="toolbar"><h1 class="ptitle">الأعضاء</h1></div>
    <form class="sbar" id="mq"><input name="q" placeholder="دوّر باليوزر أو الاسم…" autocomplete="off"><button class="btn primary">بحث</button></form>
    <div class="layout" style="padding:0"><main><section><div class="sh"><h2>الأكثر متابعين</h2></div><div id="top">${loading()}</div></section></main>
      <aside><section><div class="sh"><h2>انضموا مؤخراً</h2></div><div id="new">${loading()}</div></section></aside></div>
  </div>${footer()}`;
  $('mq').onsubmit = e => { e.preventDefault(); const v = e.target.q.value.trim(); if (v) navigate(`/search?q=${encodeURIComponent(v)}&k=users`); };
  const [stats, fresh] = await Promise.all([
    q(sb.from('profile_stats').select('id,followers,logs,reviews').order('followers', { ascending: false }).order('logs', { ascending: false }).limit(30)),
    q(sb.from('profiles').select(U + ',bio').order('created_at', { ascending: false }).limit(12))
  ]);
  if (!ctx.alive()) return;
  const profiles = stats.length ? await q(sb.from('profiles').select(U + ',bio').in('id', stats.map(s => s.id))) : [];
  if (!ctx.alive()) return;
  const byId = new Map(profiles.map(p => [p.id, p]));
  $('top').innerHTML = stats.length ? `<div class="ulist">${stats.filter(s => byId.has(s.id)).map(s => userRow(byId.get(s.id), `${s.followers} متابع · ${s.logs} مسجّل · ${s.reviews} مراجعة`)).join('')}</div>` : '<div class="empty">ما فيه أعضاء للحين.</div>';
  $('new').innerHTML = fresh.length ? `<div class="ulist">${fresh.map(p => userRow(p)).join('')}</div>` : '';
}
