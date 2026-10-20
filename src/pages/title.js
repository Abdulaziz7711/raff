// One game / movie / show: real poster and info from RAWG/TMDB, my status + rating, community stats and reviews.
import { $, esc, stars, today, toast } from '../lib/util.js';
import { KINDS, badge } from '../lib/kinds.js';
import { detail, kindOf } from '../lib/catalog.js';
import { sb, q } from '../lib/supabase.js';
import { me, saveEntry } from '../lib/store.js';
import { E, U, myLists, addToList } from '../lib/db.js';
import { reload } from '../lib/router.js';
import { cover, card, row, sh, reviewList, av, loading, footer } from '../ui/components.js';
import { openLog, quickStatus } from '../ui/logModal.js';
import { openModal } from '../ui/modal.js';
import { requireAuth } from '../ui/auth-gate.js';

const WISH = '<i class="wi"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg></i>';
const PLAY = '<i class="pz"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></i>';
const PAUSE = '<i class="pi"><svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg></i>';
const SICONS = { done: badge('done'), played: badge('played'), dropped: badge('dropped'), playing: PLAY, paused: PAUSE, wish: WISH };

export async function titlePage({ id }, ctx) {
  const kind = kindOf(id);
  if (!kind || !/^[gims]\d+$/.test(id)) { $('view').innerHTML = '<div class="wrap page"><div class="empty">الرابط غلط.</div></div>'; return; }
  document.getElementById('app').dataset.kind = kind;
  $('view').innerHTML = `<div class="tback"></div><div class="wrap">${loading()}</div>`;
  let d;
  try { d = await detail(id); }
  catch (e) {
    if (!ctx.alive()) return;
    $('view').innerHTML = `<div class="wrap page"><div class="empty">${e.status === 404 ? 'ما لقينا هذا العمل.' : 'ما قدرنا نجيب معلومات العمل الحين، جرّب بعد شوي.'}</div></div>`;
    return;
  }
  if (!ctx.alive()) return;
  const t = d.title, x = d.extra || {}, K = KINDS[kind];
  document.title = `${t.title}${t.year ? ` (${t.year})` : ''} — رفّ`;

  const facts = [
    t.year && ['السنة', t.year],
    t.by && [{ games: 'المطوّر', movies: 'المخرج', shows: 'من' }[kind], t.by],
    x.runtime && ['المدة', `${x.runtime} دقيقة`],
    x.seasons && ['المواسم', `${x.seasons}${x.episodes ? ` · ${x.episodes} حلقة` : ''}`],
    x.playtime && ['متوسط اللعب', `${x.playtime} ساعة`],
    x.metacritic && ['Metacritic', x.metacritic],
    x.score && ['تقييم النقاد', `${x.score}/100`]
  ].filter(Boolean);

  $('view').innerHTML = `
    <div class="tback">${t.backdrop ? `<img src="${esc(t.backdrop)}" alt="">` : ''}</div>
    <div class="wrap">
      <section class="thead">
        ${cover(t, { eager: true })}
        <div class="tinfo">
          <h1>${esc(t.title)}</h1>
          ${t.original_title ? `<div class="orig">${esc(t.original_title)}</div>` : ''}
          <div class="tmeta">${facts.map(([k, v]) => `<span>${k}: <b>${esc(v)}</b></span>`).join('')}</div>
          <div class="pills">${t.sub && kind === 'shows' ? `<span class="pill">${esc(t.sub)}</span>` : ''}${(t.genres || []).map(g => `<span class="pill">${esc(g)}</span>`).join('')}</div>
          ${kind === 'games' && t.platforms?.length ? `<div class="tmeta"><span>المنصات: <b>${esc(t.platforms.join('، '))}</b></span></div>` : ''}
          ${x.tagline ? `<p class="about" style="color:var(--mute);font-style:italic">${esc(x.tagline)}</p>` : ''}
          ${t.about ? `<p class="about clamp" data-more dir="auto">${esc(t.about)}</p>` : ''}
          ${x.cast?.length ? `<div class="tmeta"><span>بطولة: <b>${esc(x.cast.join('، '))}</b></span></div>` : ''}
        </div>
        <div class="tpanel" id="panel"></div>
      </section>
      <div class="tbody">
        <main>
          <section id="friendsSec" hidden></section>
          <section>${sh('المراجعات', '<span class="chips" style="margin:0" id="revSort"><button class="chip" data-s="pop" aria-pressed="true" type="button">الأشهر</button><button class="chip" data-s="new" aria-pressed="false" type="button">الأحدث</button></span>')}<div id="revs">${loading()}</div></section>
          ${d.related?.length ? `<section>${sh(kind === 'games' ? 'من نفس السلسلة' : 'أعمال مشابهة')}${row(d.related.map(r => card(r, { caption: true })), '')}</section>` : ''}
        </main>
        <aside>
          <section>${sh('تقييم الأعضاء')}<div id="stats">${loading()}</div></section>
          ${x.website ? `<section><p class="attr"><a href="${esc(x.website)}" target="_blank" rel="noopener">الموقع الرسمي ↗</a></p></section>` : ''}
        </aside>
      </div>
    </div>${footer()}`;

  $('view').querySelector('[data-more]')?.addEventListener('click', e => e.currentTarget.classList.toggle('clamp'));

  /* ---- my panel ---- */
  function panel() {
    const e = me.entries.get(t.id);
    const r = +(e?.rating || 0);
    $('panel').innerHTML = `
      <div class="sbtns">${['done', 'played', 'playing', 'paused', 'dropped', 'wish'].map(s => `<button type="button" data-st="${s}" aria-pressed="${e?.status === s}">${SICONS[s]}${esc(K[s])}</button>`).join('')}</div>
      <div><div class="rate" data-rate>${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" class="${r >= n ? 'full' : r >= n - .5 ? 'half' : ''}" aria-label="${n} نجوم">★<i>★</i></button>`).join('')}</div>
        <div class="rate-l" data-ratel>${r ? `تقييمك: ${r} ★` : 'اضغط على النجمة (نص النجمة = نص تقييم)'}</div></div>
      <button class="btn primary" type="button" data-log>${e ? (e.review ? 'تعديل التسجيل والمراجعة' : 'تعديل / اكتب مراجعة') : 'سجّل واكتب مراجعة'}</button>
      <div class="tlinks"><button class="btn" type="button" data-addlist>+ أضف لقائمة</button>${e ? `<a class="btn" href="/u/${esc(me.profile.username)}?k=${kind}" data-link style="text-align:center">رفّي</a>` : ''}</div>`;
  }
  panel();
  $('panel').onclick = async ev => {
    const st = ev.target.closest('[data-st]');
    if (st) { if (await quickStatus(t, st.dataset.st)) { panel(); loadStats(); } return; }
    const star = ev.target.closest('[data-n]');
    if (star) {
      if (!requireAuth()) return;
      const n = +star.dataset.n, rect = star.getBoundingClientRect();
      // the rating row is LTR: left half of a star = half point
      const val = (ev.clientX - rect.left) < rect.width / 2 ? n - .5 : n;
      const cur = me.entries.get(t.id);
      const rating = +(cur?.rating || 0) === val ? 0 : val;
      await saveEntry(t.id, { rating, status: cur?.status || 'done', date: cur ? cur.date : today() });
      toast(rating ? `قيّمتها ${rating} ★` : 'شلت التقييم'); panel(); loadStats(); return;
    }
    if (ev.target.closest('[data-log]')) { if (await openLog(t)) reload(); return; }
    if (ev.target.closest('[data-addlist]')) addToListModal(t);
  };

  /* ---- community stats ---- */
  async function loadStats() {
    const s = await q(sb.from('title_stats').select('*').eq('title_id', t.id).maybeSingle()).catch(() => null);
    if (!ctx.alive()) return;
    const hist = s?.hist || Array(10).fill(0), max = Math.max(1, ...hist);
    $('stats').innerHTML = `
      <div class="avg"><b>${s?.avg_rating ? (+s.avg_rating).toFixed(1) : '—'}</b><span class="stars">${stars(Math.round((+s?.avg_rating || 0) * 2) / 2)}</span><span>${s?.ratings || 0} تقييم</span></div>
      <div class="hist" style="margin-top:10px">${hist.map((c, ix) => `<i style="height:${Math.max(4, c / max * 100)}%" title="${(ix + 1) / 2}★: ${c}"></i>`).join('')}</div>
      <div class="hist-l"><span>½</span><span>★★★★★</span></div>
      <div class="tstat" style="margin-top:14px"><div><b>${s?.logs || 0}</b><span>${{ games: 'لعبوها', movies: 'شافوه', shows: 'تابعوه' }[kind]}</span></div><div><b>${s?.playing || 0}</b><span>الحين</span></div><div><b>${s?.wishes || 0}</b><span>بقوائمهم</span></div></div>`;
  }
  loadStats();

  /* ---- friends who logged it ---- */
  const fids = [...me.following];
  if (fids.length) {
    q(sb.from('entries').select(`status,rating,user:profiles!user_id(${U})`).eq('title_id', t.id).in('user_id', fids).limit(24)).then(list => {
      if (!ctx.alive() || !list.length) return;
      const sec = $('friendsSec'); sec.hidden = false;
      sec.innerHTML = sh('اللي تتابعهم') + `<div class="mini-users">${list.map(x => `<a href="/u/${esc(x.user.username)}" data-link title="${esc(x.user.display_name || x.user.username)} · ${esc(KINDS[kind][x.status])}">${av(x.user, 48)}<span>${esc(x.user.display_name || x.user.username)}</span><span class="stars">${stars(x.rating) || '&nbsp;'}</span></a>`).join('')}</div>`;
    });
  }

  /* ---- reviews ---- */
  let sort = 'pop';
  async function loadRevs() {
    let r = sb.from('entries').select(E).eq('title_id', t.id).not('review', 'is', null);
    r = sort === 'pop' ? r.order('likes_count', { ascending: false }).order('reviewed_at', { ascending: false }) : r.order('reviewed_at', { ascending: false });
    const list = await q(r.limit(30)).catch(() => []);
    if (!ctx.alive()) return;
    $('revs').innerHTML = list.length ? reviewList(list, { showTitle: false }) : `<div class="empty">ما فيه مراجعات للحين. كن أول واحد يكتب عن ${esc(t.title)}.</div>`;
  }
  loadRevs();
  $('revSort').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    sort = b.dataset.s; $('revSort').querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', x === b)); loadRevs();
  };
}

export async function addToListModal(t) {
  if (!requireAuth()) return;
  const lists = await myLists(t.kind).catch(() => []);
  const { el, close } = openModal(`<h3>أضف «${esc(t.title)}» لقائمة</h3>
    ${lists.length ? `<div class="ulist">${lists.map(l => { const has = l.list_items.some(i => i.title_id === t.id); return `<button class="srow" type="button" data-l="${l.id}" ${has ? 'disabled' : ''} style="grid-template-columns:1fr auto"><span><b>${esc(l.title)}</b><small>${l.list_items.length} ${KINDS[t.kind].unit}</small></span>${has ? '<span class="have">موجودة ✓</span>' : ''}</button>`; }).join('')}</div>`
      : `<div class="empty">ما عندك قوائم ${KINDS[t.kind].name} للحين.</div>`}
    <form class="sbar" data-new><input name="title" maxlength="60" placeholder="أو سوّ قائمة جديدة…" required><button class="btn primary">سوّها وأضف</button></form>
    <div class="m-actions"><span></span><button type="button" class="btn" data-close>إغلاق</button></div>`);
  el.onclick = async e => {
    const b = e.target.closest('[data-l]'); if (!b || b.disabled) return;
    b.disabled = true;
    try { await addToList(b.dataset.l, t.id); close(); toast('انضافت ✓'); } catch { toast('ما انضافت، جرّب مرة ثانية'); b.disabled = false; }
  };
  el.querySelector('[data-new]').onsubmit = async e => {
    e.preventDefault();
    const title = e.target.title.value.trim(); if (!title) return;
    try {
      const l = await q(sb.from('lists').insert({ user_id: me.user.id, kind: t.kind, title }).select('id').single());
      await addToList(l.id, t.id); close(); toast('انضافت ✓');
    } catch { toast('ما انحفظت، جرّب مرة ثانية'); }
  };
}
