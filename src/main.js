import './original.css';
import './app.css';
import { $, esc, debounce, toast } from './lib/util.js';
import { sb, configured, q } from './lib/supabase.js';
import { me, loadMe, onMe, toggleFollow, toggleLike } from './lib/store.js';
import { route, startRouter, navigate, render } from './lib/router.js';
import { search } from './lib/catalog.js';
import { U } from './lib/db.js';
import { svg, av, cover } from './ui/components.js';
import { closeAll } from './ui/modal.js';
import { openSearch } from './ui/searchModal.js';
import { requireAuth } from './ui/auth-gate.js';
import { homePage } from './pages/home.js';
import { loginPage, signupPage, resetPage, newPasswordPage } from './pages/auth.js';
import { profilePage, invalidateProfile } from './pages/profile.js';
import { titlePage } from './pages/title.js';
import { reviewPage } from './pages/review.js';
import { listPage } from './pages/list.js';
import { explorePage, searchPage, membersPage } from './pages/browse.js';
import { activityPage, unreadCount } from './pages/activity.js';
import { settingsPage } from './pages/settings.js';
import { importPage } from './pages/import.js';

route('/', homePage);
route('/login', loginPage);
route('/signup', signupPage);
route('/reset', resetPage);
route('/new-password', newPasswordPage);
route('/u/:name/:view?', profilePage);
route('/t/:id', titlePage);
route('/r/:id', reviewPage);
route('/list/:id', listPage);
route('/explore/:kind?', explorePage);
route('/search', searchPage);
route('/members', membersPage);
route('/activity', activityPage);
route('/settings', settingsPage);
route('/import', importPage);
route('/.*', () => { $('view').innerHTML = '<div class="wrap page"><div class="empty">الصفحة مو موجودة. <a href="/" data-link style="color:var(--accent)">ارجع للرئيسية</a></div></div>'; });

const curKind = () => document.getElementById('app').dataset.kind || 'games';
let unread = 0;

/* ---------- top bar ---------- */
function topbar() {
  const p = me.profile;
  $('topbar').innerHTML = `
    <a class="logo" href="/" data-link><span class="dots"><i></i><i></i><i></i></span>رفّ</a>
    <nav class="tnav"><a href="/" data-link>الرئيسية</a><a href="/explore/games" data-link>استكشف</a><a href="/members" data-link>الأعضاء</a></nav>
    <form class="tsearch" id="tForm" role="search">${svg('search')}<input id="tQ" type="search" placeholder="ابحث عن لعبة، فيلم، مسلسل…" autocomplete="off" enterkeyhint="search" aria-label="بحث"><div class="sugg" id="sugg" hidden></div></form>
    <div class="tright">
      ${p ? `<button class="btn primary sm logbtn" type="button" data-quicklog>${svg('plus')}سجّل</button>
        <a class="ibtn bell" href="/activity" data-link aria-label="التنبيهات">${svg('bell')}${unread ? `<span class="dot-badge">${unread > 99 ? '99+' : unread}</span>` : ''}</a>
        <div class="rel me-wrap"><button class="me-btn" type="button" id="meBtn" aria-haspopup="true" aria-label="حسابي">${av(p, 36)}</button>
          <div class="menu" id="meMenu" hidden>
            <a href="/u/${esc(p.username)}" data-link><b>${esc(p.display_name || p.username)}</b><br><small class="handle">@${esc(p.username)}</small></a><hr>
            <a href="/u/${esc(p.username)}" data-link>ملفي</a><a href="/u/${esc(p.username)}/library" data-link>مكتبتي</a><a href="/u/${esc(p.username)}/lists" data-link>قوائمي</a><a href="/u/${esc(p.username)}/likes" data-link>اللايكات</a>
            <hr><a href="/settings" data-link>الإعدادات</a><button type="button" data-signout>تسجيل خروج</button></div></div>`
      : `<a class="btn sm" href="/login" data-link>دخول</a><a class="btn primary sm" href="/signup" data-link>حساب جديد</a>`}
    </div>`;
  bindSearch();
  $('meBtn')?.addEventListener('click', e => { e.stopPropagation(); $('meMenu').hidden = !$('meMenu').hidden; });
  bnav();
}
function bnav() {
  const p = me.profile, path = location.pathname;
  const cur = h => (h === '/' ? path === '/' : path.startsWith(h)) ? 'aria-current="page"' : '';
  $('bnav').innerHTML = `
    <a href="/" data-link ${cur('/')}>${svg('home')}الرئيسية</a>
    <a href="/explore/games" data-link ${cur('/explore')}>${svg('explore')}استكشف</a>
    <button type="button" data-quicklog><span class="plus">${svg('plus')}</span>سجّل</button>
    <a href="${p ? '/activity' : '/login'}" data-link ${cur('/activity')}>${svg('bell')}التنبيهات${unread ? `<span class="dot-badge">${unread > 99 ? '99+' : unread}</span>` : ''}</a>
    <a href="${p ? `/u/${esc(p.username)}` : '/login'}" data-link ${p && cur(`/u/${p.username}`)}>${p ? av(p, 28).replace('s28', 's28" style="width:22px;height:22px;font-size:11px') : svg('user')}${p ? 'ملفي' : 'دخول'}</a>`;
  document.querySelectorAll('.tnav a').forEach(a => { const h = a.getAttribute('href'); a.toggleAttribute('aria-current', h === '/' ? path === '/' : path.startsWith(h.replace('/games', ''))); if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page'); });
}

/* live suggestions: a few results from each kind + members */
function bindSearch() {
  const input = $('tQ'), box = $('sugg');
  let ctl = null, items = [], on = -1;
  const hide = () => { box.hidden = true; on = -1; };
  const run = debounce(async v => {
    ctl?.abort(); ctl = new AbortController();
    if (v.length < 2) return hide();
    box.hidden = false; box.innerHTML = '<div class="sstate">يدوّر…</div>';
    const sig = { signal: ctl.signal };
    const like = `%${v.replace(/[,()"'\\%_*]/g, ' ').trim()}%`;
    const [g, m, s, u] = await Promise.all([
      search('games', v, sig).catch(() => []), search('movies', v, sig).catch(() => []), search('shows', v, sig).catch(() => []),
      q(sb.from('profiles').select(U).or(`username.ilike.${like},display_name.ilike.${like}`).limit(3)).catch(() => [])
    ]);
    if (ctl.signal.aborted || input.value.trim() !== v) return;
    items = [];
    const sec = (title, list, fn) => list.length ? `<div class="sugg-h">${title}</div>` + list.map(x => { items.push(fn.href(x)); return fn.html(x, items.length - 1); }).join('') : '';
    const tFn = { href: t => `/t/${t.id}`, html: (t, i) => `<a class="srow" href="/t/${t.id}" data-link data-i="${i}">${cover(t)}<span><b>${esc(t.title)}</b><small>${t.year || ''}${t.sub && t.kind === 'shows' ? ' · ' + esc(t.sub) : ''}</small></span>${me.entries.get(t.id) ? '<span class="have">عندك ✓</span>' : ''}</a>` };
    const uFn = { href: p => `/u/${p.username}`, html: (p, i) => `<a class="srow" href="/u/${esc(p.username)}" data-link data-i="${i}" style="grid-template-columns:36px 1fr">${av(p, 36)}<span><b>${esc(p.display_name || p.username)}</b><small class="handle">@${esc(p.username)}</small></span></a>` };
    box.innerHTML = sec('ألعاب', g.slice(0, 3), tFn) + sec('أفلام', m.slice(0, 3), tFn) + sec('مسلسلات وأنمي', s.slice(0, 3), tFn) + sec('أعضاء', u, uFn)
      + `<button type="button" class="sugg-all" data-all>كل النتائج لـ «${esc(v)}» ‹</button>`;
  }, 280);
  input.addEventListener('input', () => run(input.value.trim()));
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2 && box.innerHTML) box.hidden = false; });
  input.addEventListener('keydown', e => {
    const links = [...box.querySelectorAll('a.srow')];
    if (box.hidden || !links.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) { if (e.key === 'Escape') hide(); return; }
    e.preventDefault();
    on = (on + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links.forEach((a, i) => a.classList.toggle('on', i === on));
  });
  $('tForm').onsubmit = e => {
    e.preventDefault();
    const v = input.value.trim();
    if (on >= 0 && items[on]) navigate(items[on]);
    else if (v) navigate(`/search?q=${encodeURIComponent(v)}&k=${curKind()}`);
    hide(); input.blur();
  };
  box.addEventListener('click', e => { if (e.target.closest('[data-all]')) { $('tForm').requestSubmit(); return; } if (e.target.closest('a')) { hide(); input.value = ''; } });
}

/* ---------- actions that can appear on any page ---------- */
document.addEventListener('click', async e => {
  const t = e.target;
  if (!t.closest('.me-wrap')) $('meMenu')?.setAttribute('hidden', '');
  if (!t.closest('#tForm')) $('sugg')?.setAttribute('hidden', '');
  if (t.closest('[data-quicklog]')) { if (requireAuth()) openSearch({ kind: curKind() }); return; }
  if (t.closest('[data-signout]')) { await sb.auth.signOut(); navigate('/'); return; }
  const sp = t.closest('[data-spoil]'); if (sp) { sp.classList.add('show'); return; }
  const lk = t.closest('[data-like]');
  if (lk && !lk.disabled) {
    e.preventDefault();
    if (!requireAuth()) return;
    lk.disabled = true;
    try {
      const on = await toggleLike(lk.dataset.like);
      document.querySelectorAll(`[data-like="${lk.dataset.like}"]`).forEach(b => { b.setAttribute('aria-pressed', on); const n = b.querySelector('span'); n.textContent = Math.max(0, +n.textContent + (on ? 1 : -1)); });
      invalidateProfile();
    } catch { toast('ما ضبط اللايك، جرّب مرة ثانية'); }
    lk.disabled = false; return;
  }
  const fb = t.closest('[data-follow]');
  if (fb) {
    if (!requireAuth()) return;
    fb.disabled = true;
    try {
      const on = await toggleFollow(fb.dataset.follow);
      document.querySelectorAll(`[data-follow="${fb.dataset.follow}"]`).forEach(b => { b.setAttribute('aria-pressed', on); b.textContent = on ? 'تتابعه ✓' : '+ تابِع'; });
    } catch { toast('ما ضبطت، جرّب مرة ثانية'); }
    fb.disabled = false;
  }
});

async function refreshUnread() { unread = await unreadCount(); topbar(); }
document.addEventListener('raff-unread', () => { unread = 0; topbar(); });
document.addEventListener('route', () => { closeAll(); bnav(); });
onMe(() => topbar());

/* ---------- boot ---------- */
async function boot() {
  if (!configured) {
    $('view').innerHTML = `<div class="wrap page"><div class="empty">الموقع محتاج إعداد: أضف <code>VITE_SUPABASE_URL</code> و<code>VITE_SUPABASE_ANON_KEY</code> في إعدادات Vercel (Environment Variables) وبعدها سوّ Redeploy. التفاصيل في ملف SETUP.md.</div></div>`;
    return;
  }
  const { data } = await sb.auth.getSession();
  await loadMe(data.session?.user).catch(e => { console.error(e); });
  topbar();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (event === 'PASSWORD_RECOVERY') { navigate('/new-password'); return; }
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { if (session) me.user = session.user; return; }
    // supabase-js warns against awaiting other supabase calls inside this callback
    setTimeout(async () => {
      const uid = session?.user?.id || null;
      if (uid === (me.user?.id || null)) return;
      await loadMe(session?.user).catch(console.error);
      invalidateProfile();
      if (event === 'SIGNED_IN') {
        const next = sessionStorage.getItem('raff-next'); sessionStorage.removeItem('raff-next');
        if (next || ['/login', '/signup'].includes(location.pathname)) navigate(next || '/'); else render();
      } else render();
      refreshUnread();
    }, 0);
  });
  await startRouter();
  refreshUnread();
  setInterval(() => { if (me.user && !document.hidden) refreshUnread(); }, 120000);
}
boot();
