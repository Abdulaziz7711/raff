import './demo.css';
// Demo build entry: a strip that says this is the offline demo, then the real app.
import { sb } from './mock-supabase.js';
import { DEMO_EMAIL, DEMO_PASSWORD } from './seed.js';

const strip = document.createElement('div');
strip.className = 'demo-strip';
strip.innerHTML = `<div class="wrap"><span><b>نسخة تجريبية</b> · بياناتها في متصفحك بس. ادخل بـ <code dir="ltr">${DEMO_EMAIL}</code> / <code dir="ltr">${DEMO_PASSWORD}</code> أو سوّ حساب جديد.</span><button type="button" class="btn sm" id="demoReset">ابدأ من جديد</button></div>`;
document.getElementById('app').prepend(strip);
document.getElementById('demoReset').onclick = e => {
  if (!e.currentTarget.dataset.armed) { e.currentTarget.dataset.armed = '1'; e.currentTarget.textContent = 'متأكد؟ يمسح كل التعديلات'; return; }
  sb._reset();
};

// the settings page deletes accounts through /api/delete-account; answer it locally
const realFetch = window.fetch.bind(window);
window.fetch = (u, opts) => String(u).startsWith('/api/delete-account')
  ? (sb._deleteMe(), Promise.resolve(new Response('{"ok":true}', { status: 200 })))
  : realFetch(u, opts);

// prefill the demo login so it's one tap
new MutationObserver(() => {
  const f = document.querySelector('.auth');
  if (f?.email && !f.dataset.filled && f.querySelector('h1')?.textContent === 'تسجيل الدخول') { f.dataset.filled = '1'; f.email.value = DEMO_EMAIL; f.password.value = DEMO_PASSWORD; }
}).observe(document.getElementById('view'), { childList: true, subtree: true });

import '../src/main.js';
