// A list page. Anyone can view and like it; the owner reorders, removes, adds (from search) and edits it.
import { $, esc, stars, toast } from '../lib/util.js';
import { KINDS } from '../lib/kinds.js';
import { sb, q } from '../lib/supabase.js';
import { me, toggleListLike } from '../lib/store.js';
import { getList, saveListOrder, addToList } from '../lib/db.js';
import { navigate, reload } from '../lib/router.js';
import { cover, av, uname, svg, loading, footer } from '../ui/components.js';
import { openModal, armed } from '../ui/modal.js';
import { openSearch } from '../ui/searchModal.js';
import { requireAuth } from '../ui/auth-gate.js';
import { invalidateProfile } from './profile.js';

export async function listPage({ id }, ctx) {
  $('view').innerHTML = `<div class="wrap page">${loading()}</div>`;
  const l = /^[0-9a-f-]{36}$/.test(id) ? await getList(id) : null;
  if (!ctx.alive()) return;
  if (!l) { $('view').innerHTML = '<div class="wrap page"><div class="empty">القائمة مو موجودة أو انحذفت.</div></div>'; return; }
  const K = KINDS[l.kind], own = me.user?.id === l.user_id;
  const items = l.list_items.slice().sort((a, b) => a.position - b.position).map(i => i.title).filter(Boolean);
  document.getElementById('app').dataset.kind = l.kind;
  document.title = `${l.title} — رفّ`;
  const liked = me.likedLists.has(l.id);

  $('view').innerHTML = `<div class="wrap page"><main class="full"><section>
    <div class="toolbar"><h2>${esc(l.title)}</h2><span style="display:flex;gap:6px;align-items:center">
      <button class="likebtn big" type="button" data-llike aria-pressed="${liked}" ${own ? 'disabled title="ما تقدر تعطي قائمتك لايك"' : ''}>${svg('heart')}<span>${l.likes_count}</span></button>
      ${own ? '<button class="btn sm" type="button" data-edit>تعديل</button>' : ''}</span></div>
    <div class="lhead" style="margin-bottom:12px"><a href="/u/${esc(l.user.username)}?k=${l.kind}" data-link>${av(l.user, 28)}${uname(l.user)}</a><span>· ${items.length} ${K.unit}</span></div>
    ${l.description ? `<p class="ldesc">${esc(l.description)}</p>` : ''}
    ${items.length ? `<div class="${l.ranked ? 'ranked' : 'posters'}">${items.map((t, ix) => l.ranked || own ? `<div class="ritem"><span class="n">${l.ranked ? ix + 1 : '•'}</span><a href="/t/${t.id}" data-link>${cover(t)}</a>
      <a href="/t/${t.id}" data-link><h4>${esc(t.title)}</h4><small>${t.year || ''} ${me.entries.get(t.id) ? `· <span class="stars">${stars(me.entries.get(t.id).rating)}</span> <span class="have">عندك ✓</span>` : ''}</small></a>
      ${own ? `<div class="ctl"><button type="button" data-mv="-1" data-ix="${ix}" aria-label="فوق" ${ix === 0 ? 'disabled' : ''}>▲</button><button type="button" data-mv="1" data-ix="${ix}" aria-label="تحت" ${ix === items.length - 1 ? 'disabled' : ''}>▼</button><button type="button" data-rm="${ix}" aria-label="شيل">✕</button></div>` : '<span></span>'}</div>`
      : `<a class="card" href="/t/${t.id}" data-link>${cover(t)}</a>`).join('')}</div>`
      : `<div class="empty">القائمة فاضية.${own ? ' أضف من تحت.' : ''}</div>`}
    ${own ? `<div class="adder"><button class="btn primary" type="button" data-add>+ ابحث وأضف للقائمة</button></div>` : ''}
  </section></main></div>${footer()}`;

  const root = $('view').firstElementChild; // handlers live on the page wrapper, not on #view, so they go away with the page
  root.querySelector('[data-llike]').onclick = async e => {
    if (!requireAuth()) return;
    const b = e.currentTarget; b.disabled = true;
    try { const on = await toggleListLike(l.id); l.likes_count += on ? 1 : -1; b.setAttribute('aria-pressed', on); b.querySelector('span').textContent = l.likes_count; } catch { toast('ما ضبط، جرّب مرة ثانية'); }
    b.disabled = false;
  };
  if (!own) return;
  const ids = items.map(t => t.id);
  const save = async () => { try { await saveListOrder(l.id, ids); invalidateProfile(); reload(); } catch { toast('ما انحفظ، جرّب مرة ثانية'); } };
  root.onclick = async e => {
    const mv = e.target.closest('[data-mv]');
    if (mv) { const a = +mv.dataset.ix, b = a + (+mv.dataset.mv); [ids[a], ids[b]] = [ids[b], ids[a]]; return save(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { ids.splice(+rm.dataset.rm, 1); return save(); }
    if (e.target.closest('[data-add]')) {
      openSearch({ kind: l.kind, title: `أضف لـ «${l.title}»`, onPick: async r => {
        if (ids.includes(r.id)) return toast('موجودة في القائمة');
        try { await addToList(l.id, r.id); invalidateProfile(); toast('انضافت ✓'); reload(); } catch { toast('ما انضافت، جرّب مرة ثانية'); }
      } });
    }
    if (e.target.closest('[data-edit]')) editList(l);
  };
}

function editList(l) {
  const { el, close } = openModal(`<h3>تعديل القائمة</h3>
    <label class="f">اسم القائمة<input name="title" required maxlength="60" value="${esc(l.title)}" autofocus></label>
    <label class="f">وصف (اختياري)<textarea name="description" maxlength="300" style="min-height:60px">${esc(l.description)}</textarea></label>
    <label class="check"><input type="checkbox" name="ranked" ${l.ranked ? 'checked' : ''}> قائمة مرتّبة (بأرقام)</label>
    <div class="m-actions"><button type="button" class="btn danger" data-del>حذف القائمة</button>
      <span style="display:flex;gap:8px"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">حفظ</button></span></div>`, { form: true });
  el.onsubmit = async e => {
    e.preventDefault();
    try { await q(sb.from('lists').update({ title: el.title.value.trim(), description: el.description.value.trim(), ranked: el.ranked.checked }).eq('id', l.id)); invalidateProfile(); close(); reload(); }
    catch { toast('ما انحفظ، جرّب مرة ثانية'); }
  };
  el.querySelector('[data-del]').onclick = async e => {
    if (!armed(e.currentTarget)) return;
    try { await q(sb.from('lists').delete().eq('id', l.id)); invalidateProfile(); close(); navigate(`/u/${me.profile.username}/lists?k=${l.kind}`); }
    catch { toast('ما انحذفت'); }
  };
}
