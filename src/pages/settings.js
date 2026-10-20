// Account settings: username, email, password, sign out, delete account.
import { $, esc, toast } from '../lib/util.js';
import { sb, q } from '../lib/supabase.js';
import { me, setProfile } from '../lib/store.js';
import { navigate } from '../lib/router.js';
import { armed } from '../ui/modal.js';
import { requireAuth } from '../ui/auth-gate.js';
import { invalidateProfile } from './profile.js';
import legacy from '../legacy.json';
import { THEMES, THEME_NAME, getTheme, setTheme } from '../lib/theme.js';

export function settingsPage() {
  if (!requireAuth()) return;
  document.getElementById('app').dataset.kind = 'games';
  document.title = 'الإعدادات — رفّ';
  const p = me.profile;
  $('view').innerHTML = `<div class="wrap page"><h1 class="ptitle">الإعدادات</h1><div class="settings">
    <div class="card-box"><h2>المظهر</h2><div class="chips" id="sTheme" style="margin:0">${THEMES.map(t => `<button class="chip" type="button" data-t="${t}" aria-pressed="${getTheme() === t}">${THEME_NAME[t]}</button>`).join('')}</div></div>
    <form class="card-box" id="sUser"><h2>اسم المستخدم</h2>
      <label class="f">رابط صفحتك العامة<span class="pre"><span>${esc(location.host)}/u/</span><input name="username" value="${esc(p.username)}" required pattern="[A-Za-z0-9_]{3,20}" maxlength="20"></span></label>
      <p class="hint">إذا غيّرته، الرابط القديم يوقف يشتغل.</p>
      <div><button class="btn primary">حفظ</button> <span data-msg></span></div></form>
    <form class="card-box" id="sEmail"><h2>الإيميل</h2>
      <label class="f">الإيميل<input name="email" type="email" value="${esc(me.user.email || '')}" required dir="ltr"></label>
      <div><button class="btn primary">تغيير</button> <span data-msg></span></div></form>
    <form class="card-box" id="sPass"><h2>كلمة المرور</h2>
      <label class="f">كلمة مرور جديدة<input name="password" type="password" minlength="6" required dir="ltr" autocomplete="new-password"></label>
      <div><button class="btn primary">تغيير</button> <span data-msg></span></div></form>
    <div class="card-box"><h2>نقل بياناتي القديمة</h2><p class="hint">ينقل ${legacy.items.length} عنصر و${legacy.lists.length} قائمة من نسخة «رفّ» القديمة لحسابك، ويطابق كل عنوان مع RAWG وTMDB عشان تطلع البوسترات.</p>
      <div><a class="btn" href="/import" data-link>افتح صفحة النقل</a></div></div>
    <div class="card-box"><h2>الحساب</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="sOut">تسجيل خروج</button><button class="btn danger" type="button" id="sDel">حذف الحساب نهائياً</button></div>
      <p class="hint">حذف الحساب يمسح ملفك ومكتبتك ومراجعاتك وقوائمك ولايكاتك، وما يرجع.</p></div>
    <div class="card-box"><h2>عن رفّ</h2><p class="hint">بيانات الألعاب وصورها من <a href="https://www.igdb.com" target="_blank" rel="noopener">IGDB</a> أو <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a>، وبيانات الأفلام والمسلسلات والأنمي من <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div>
  </div></div>`;
  const msg = (f, t, ok = true) => { const s = f.querySelector('[data-msg]'); s.className = ok ? 'ok' : 'err'; s.textContent = t; };

  $('sUser').onsubmit = async e => {
    e.preventDefault(); const f = e.target, u = f.username.value.trim();
    if (u === p.username) return;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return msg(f, 'حروف إنجليزية وأرقام و _ فقط، من 3 إلى 20.', false);
    if (u.toLowerCase() !== p.username.toLowerCase()) {
      const { data: free } = await sb.rpc('username_available', { name: u });
      if (!free) return msg(f, 'مأخوذ، جرّب غيره.', false);
    }
    try { await q(sb.from('profiles').update({ username: u }).eq('id', me.user.id)); setProfile({ username: u }); invalidateProfile(); msg(f, 'انحفظ ✓'); }
    catch { msg(f, 'ما انحفظ، جرّب غيره.', false); }
  };
  $('sEmail').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.auth.updateUser({ email: f.email.value.trim() }, { emailRedirectTo: location.origin + '/settings' });
    error ? msg(f, 'ما تغيّر: ' + error.message, false) : msg(f, 'أرسلنا رابط تأكيد للإيميل الجديد.');
  };
  $('sPass').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    error ? msg(f, 'ما تغيّرت: ' + error.message, false) : (f.reset(), msg(f, 'تغيّرت ✓'));
  };
  $('sTheme').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; setTheme(b.dataset.t); $('sTheme').querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('sOut').onclick = async () => { await sb.auth.signOut(); navigate('/'); };
  $('sDel').onclick = async e => {
    if (!armed(e.currentTarget, 'متأكد؟ كل شي بينمسح. اضغط مرة ثانية')) return;
    const { data } = await sb.auth.getSession();
    const r = await fetch('/api/delete-account', { method: 'POST', headers: { authorization: 'Bearer ' + data.session?.access_token } });
    if (!r.ok) return toast('ما انحذف الحساب، جرّب مرة ثانية');
    await sb.auth.signOut(); toast('انحذف الحساب'); navigate('/');
  };
}
