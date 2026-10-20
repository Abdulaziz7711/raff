// Overlay + modal with the original look. Esc and clicking outside close it.
const stack = [];
export function openModal(html, { width = 470, form = false, onClose } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<${form ? 'form' : 'div'} class="modal" style="width:min(${width}px,100%)">${html}</${form ? 'form' : 'div'}>`;
  document.getElementById('app').appendChild(ov);
  const el = ov.firstElementChild;
  const close = () => { if (!ov.isConnected) return; ov.remove(); stack.splice(stack.indexOf(close), 1); onClose?.(); };
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  stack.push(close);
  setTimeout(() => el.querySelector('[autofocus]')?.focus(), 0);
  return { el, close };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1](); });
export const closeAll = () => [...stack].forEach(c => c());

// two-step "are you sure" for destructive buttons
export function armed(btn, label = 'متأكد؟ اضغط مرة ثانية') {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; btn.dataset.orig = btn.textContent; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = btn.dataset.orig; } }, 4000);
  return false;
}
