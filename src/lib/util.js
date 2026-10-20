export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const YEAR = String(new Date().getFullYear());
export function hue(t) { let h = 0; for (const c of String(t || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
export function stars(r) { r = +r || 0; if (!r) return ''; return '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : ''); }

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function fmtDate(d) {
  if (!d) return '';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${+dd} ${MONTHS[+m - 1]}${y !== YEAR ? ' ' + y : ''}`;
}
export function ago(ts) {
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'الحين';
  if (s < 3600) return `قبل ${Math.floor(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} س`;
  if (s < 86400 * 7) return `قبل ${Math.floor(s / 86400)} يوم`;
  return fmtDate(new Date(ts).toISOString());
}
export const today = () => new Date().toISOString().slice(0, 10);
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

let toastT;
export function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.getElementById('app').appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600);
}
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const qsGet = k => new URLSearchParams(location.search).get(k);
