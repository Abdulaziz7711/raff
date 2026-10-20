import { $, qsGet } from '../lib/util.js';
import { sb, googleEnabled } from '../lib/supabase.js';
import { me } from '../lib/store.js';
import { navigate, here } from '../lib/router.js';

const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const next = () => { const n = qsGet('next'); return n && n.startsWith('/') && !n.startsWith('//') ? n : '/'; };
const googleBlock = () => googleEnabled ? `<button type="button" class="btn gbtn" data-google>${GOOGLE} كمّل بحساب Google</button><div class="or">أو</div>` : '';
const AR_ERR = {
  'Invalid login credentials': 'الإيميل أو كلمة المرور غلط.',
  'Email not confirmed': 'لازم تأكد إيميلك أول. شيك على بريدك.',
  'User already registered': 'هذا الإيميل مسجّل من قبل. جرّب تسجّل دخول.',
  'Password should be at least 6 characters.': 'كلمة المرور لازم تكون 6 خانات أو أكثر.'
};
const arErr = e => AR_ERR[e?.message] || (/rate limit/i.test(e?.message) ? 'محاولات كثيرة، استنى شوي وجرّب.' : 'صار خطأ: ' + (e?.message || ''));

function shell(html) {
  document.getElementById('app').dataset.kind = 'games';
  $('view').innerHTML = `<div class="wrap"><form class="auth" novalidate>${html}<p class="err" data-err hidden></p><p class="ok" data-ok hidden></p></form></div>`;
  const f = $('view').querySelector('form');
  const msg = (sel, m) => { const p = f.querySelector(sel); p.textContent = m || ''; p.hidden = !m; };
  f.querySelector('[data-google]')?.addEventListener('click', () =>
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + next() } }));
  return { f, err: m => msg('[data-err]', m), ok: m => msg('[data-ok]', m) };
}
const busy = (f, on) => { const b = f.querySelector('.btn.primary'); b.disabled = on; };

export function loginPage() {
  if (me.user) return navigate(next(), { replace: true });
  const { f, err } = shell(`<h1>تسجيل الدخول</h1>${googleBlock()}
    <label class="f">الإيميل<input name="email" type="email" autocomplete="email" required dir="ltr" autofocus></label>
    <label class="f">كلمة المرور<input name="password" type="password" autocomplete="current-password" required dir="ltr"></label>
    <button class="btn primary">دخول</button>
    <div class="alt"><a href="/reset" data-link>نسيت كلمة المرور؟</a></div>
    <div class="alt">ما عندك حساب؟ <a href="/signup${here().search}" data-link>سوّ حساب</a></div>`);
  f.onsubmit = async e => {
    e.preventDefault(); err(''); busy(f, true);
    // onAuthStateChange in main.js loads the profile and then routes to `next`
    sessionStorage.setItem('raff-next', next());
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    busy(f, false);
    if (error) { sessionStorage.removeItem('raff-next'); return err(arErr(error)); }
  };
}

export function signupPage() {
  if (me.user) return navigate('/', { replace: true });
  const { f, err, ok } = shell(`<h1>حساب جديد</h1><p>رفّك الخاص لكل اللي لعبته وشفته.</p>${googleBlock()}
    <label class="f">اسم المستخدم (يطلع في رابط صفحتك)<span class="pre"><span>raff/u/</span><input name="username" required pattern="[A-Za-z0-9_]{3,20}" maxlength="20" autocomplete="username" placeholder="Abdulaziz771"></span></label>
    <small class="hint">حروف إنجليزية وأرقام و _ فقط، من 3 إلى 20.</small>
    <label class="f">الاسم اللي يطلع للناس<input name="display_name" maxlength="40" placeholder="اختياري"></label>
    <label class="f">الإيميل<input name="email" type="email" autocomplete="email" required dir="ltr"></label>
    <label class="f">كلمة المرور<input name="password" type="password" autocomplete="new-password" required minlength="6" dir="ltr"></label>
    <button class="btn primary">سوّ الحساب</button>
    <div class="alt">عندك حساب؟ <a href="/login${here().search}" data-link>سجّل دخول</a></div>`);
  f.onsubmit = async e => {
    e.preventDefault(); err(''); ok('');
    const username = f.username.value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return err('اسم المستخدم لازم يكون حروف إنجليزية وأرقام و _ فقط، من 3 إلى 20.');
    if (f.password.value.length < 6) return err('كلمة المرور لازم تكون 6 خانات أو أكثر.');
    busy(f, true);
    const { data: free } = await sb.rpc('username_available', { name: username });
    if (free === false) { busy(f, false); return err('اسم المستخدم مأخوذ، جرّب غيره.'); }
    sessionStorage.setItem('raff-next', `/u/${username}`);
    const { data, error } = await sb.auth.signUp({
      email: f.email.value.trim(), password: f.password.value,
      options: { data: { username, display_name: f.display_name.value.trim() || username }, emailRedirectTo: location.origin + '/' }
    });
    busy(f, false);
    if (error) { sessionStorage.removeItem('raff-next'); return err(arErr(error)); }
    if (!data.session) { f.querySelectorAll('label,.btn.primary,small.hint,.gbtn,.or').forEach(x => x.hidden = true); ok(`أرسلنا رابط تأكيد لـ ${f.email.value.trim()}. افتحه وبعدها سجّل دخولك.`); }
  };
}

export function resetPage() {
  const { f, err, ok } = shell(`<h1>نسيت كلمة المرور</h1><p>اكتب إيميلك ونرسل لك رابط تغيّر فيه كلمة المرور.</p>
    <label class="f">الإيميل<input name="email" type="email" required dir="ltr" autofocus></label>
    <button class="btn primary">أرسل الرابط</button>
    <div class="alt"><a href="/login" data-link>‹ رجوع لتسجيل الدخول</a></div>`);
  f.onsubmit = async e => {
    e.preventDefault(); err(''); busy(f, true);
    const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + '/new-password' });
    busy(f, false);
    if (error) return err(arErr(error));
    ok('إذا الإيميل مسجّل عندنا، بيوصلك رابط خلال دقايق.');
  };
}

export function newPasswordPage() {
  const { f, err, ok } = shell(`<h1>كلمة مرور جديدة</h1>
    <label class="f">كلمة المرور الجديدة<input name="password" type="password" required minlength="6" dir="ltr" autocomplete="new-password" autofocus></label>
    <button class="btn primary">حفظ</button>`);
  f.onsubmit = async e => {
    e.preventDefault(); err('');
    if (f.password.value.length < 6) return err('كلمة المرور لازم تكون 6 خانات أو أكثر.');
    busy(f, true);
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    busy(f, false);
    if (error) return err(arErr(error));
    ok('تغيّرت ✓'); setTimeout(() => navigate('/'), 1200);
  };
}
