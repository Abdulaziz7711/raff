// Theme choice: 'system' (follow the device), 'light' or 'dark'. Remembered in this browser only.
const KEY = 'raff-theme';
export const THEMES = ['system', 'light', 'dark'];
export const THEME_NAME = { system: 'تلقائي (حسب جهازك)', light: 'فاتح', dark: 'داكن' };

export function getTheme() {
  try { const t = localStorage.getItem(KEY); return THEMES.includes(t) ? t : 'system'; } catch { return 'system'; }
}
export function applyTheme(t = getTheme()) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14181d' : '#f2f4f7');
  return t;
}
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { }
  applyTheme(t);
  document.dispatchEvent(new Event('raff-theme'));
}
export const nextTheme = () => THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => applyTheme());
