// Tiny history-API router. Pages are async functions that render into #view.
const routes = [];
let current = 0;

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:(\w+)(\?)?/g, (_, k, opt) => { keys.push(k); return opt ? '(?:/([^/]+))?' : '/([^/]+)'; }) + '/?$');
  routes.push({ re, keys, handler });
}

export async function render() {
  const id = ++current;
  const path = decodeURI(location.pathname);
  for (const r of routes) {
    const m = r.re.exec(path);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { if (m[i + 1] != null) params[k] = decodeURIComponent(m[i + 1]); });
    const ctx = { alive: () => id === current, path };
    document.dispatchEvent(new CustomEvent('route', { detail: { path } }));
    try { await r.handler(params, ctx); }
    catch (e) { console.error(e); if (ctx.alive()) document.getElementById('view').innerHTML = `<div class="wrap page"><div class="empty">صار خطأ وما قدرنا نفتح الصفحة. جرّب تحدّثها.<br><small class="err">${String(e.message || e).replace(/</g, '&lt;')}</small></div></div>`; }
    return;
  }
}

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  if (to === location.pathname + location.search && !replace) return render();
  history[replace ? 'replaceState' : 'pushState']({}, '', to);
  if (!keepScroll) window.scrollTo(0, 0);
  return render();
}
// re-render the current page in place (after saving something)
export const reload = () => render();

export function startRouter() {
  window.addEventListener('popstate', render);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    navigate(url.pathname + url.search, { keepScroll: a.hasAttribute('data-keep') });
  });
  return render();
}
