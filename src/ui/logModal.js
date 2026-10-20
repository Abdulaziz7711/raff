// The "log / edit" form for one title — same fields as the original item modal, saved to the database.
import { esc, today, toast } from '../lib/util.js';
import { KINDS, STATUSES } from '../lib/kinds.js';
import { me, saveEntry, deleteEntry } from '../lib/store.js';
import { myFavorites, saveFavorites } from '../lib/db.js';
import { openModal, armed } from './modal.js';
import { requireAuth } from './auth-gate.js';

const RATINGS = '<option value="0">بدون</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n / 2}">${n / 2} ★</option>`).join('');

// t: title {id, kind, title, year, platforms?}; returns a promise that resolves true when something was saved or deleted
export function openLog(t, { status } = {}) {
  if (!requireAuth()) return Promise.resolve(false);
  return new Promise(async resolve => {
    const K = KINDS[t.kind], cur = me.entries.get(t.id);
    const favs = await myFavorites(t.kind).catch(() => []);
    const isFav = favs.some(f => f.title_id === t.id);
    const st = status || cur?.status || 'done';
    const e = cur || { status: st, rating: 0, date: st === 'wish' ? '' : today(), review: '', spoiler: false, platform: '' };
    const plats = (t.platforms || []).filter(Boolean);
    let saved = false;
    const { el, close } = openModal(`
      <h3>${cur ? 'تعديل' : 'سجّل'}</h3>
      <div class="fixed-title">${esc(t.title)}${t.year ? ` (${t.year})` : ''}</div>
      <div class="two">
        <label class="f">الحالة<select name="status">${STATUSES.map(s => `<option value="${s}" ${s === (status || e.status) ? 'selected' : ''}>${K[s]}</option>`).join('')}</select></label>
        <label class="f">التقييم<select name="rating">${RATINGS}</select></label>
      </div>
      <div class="two">
        <label class="f">التاريخ<input type="date" name="date" value="${esc(e.date || '')}" max="${today()}"></label>
        ${t.kind === 'games' ? `<label class="f">المنصة (اختياري)<input name="platform" maxlength="40" list="plats" value="${esc(e.platform || '')}" placeholder="مثلاً: PS5"><datalist id="plats">${plats.map(p => `<option value="${esc(p)}">`).join('')}</datalist></label>` : '<span></span>'}
      </div>
      <label class="check"><input type="checkbox" name="fav" ${isFav ? 'checked' : ''}> <span>من المفضلة 👑</span></label>
      <label class="f">مراجعة (اختياري)<textarea name="review" maxlength="5000">${esc(e.review || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="spoiler" ${e.spoiler ? 'checked' : ''}> فيها حرق (تنخفي لين أحد يضغط عليها)</label>
      <p class="err" data-err hidden></p>
      <div class="m-actions">
        ${cur ? '<button type="button" class="btn danger" data-del>حذف</button>' : '<span></span>'}
        <span style="display:flex;gap:8px"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary">حفظ</button></span>
      </div>`, { form: true, onClose: () => resolve(saved) });
    el.rating.value = String(+e.rating || 0);
    const err = m => { const p = el.querySelector('[data-err]'); p.textContent = m; p.hidden = !m; };
    el.status.onchange = () => { if (el.status.value === 'wish') el.date.value = ''; else if (!el.date.value) el.date.value = today(); };

    el.onsubmit = async ev => {
      ev.preventDefault();
      const wantFav = el.fav.checked;
      if (wantFav && !isFav && favs.length >= 5) { err('المفضلة مليانة (5)، شيل وحدة أول من «تعديل الملف»'); return; }
      const btn = el.querySelector('.btn.primary'); btn.disabled = true; err('');
      try {
        await saveEntry(t.id, {
          status: el.status.value, rating: +el.rating.value, date: el.date.value || null,
          review: el.review.value.trim() || null, spoiler: el.spoiler.checked,
          platform: el.platform ? (el.platform.value.trim() || null) : null
        });
        if (wantFav !== isFav) {
          const ids = favs.map(f => f.title_id).filter(id => id !== t.id);
          if (wantFav) ids.push(t.id);
          const crown = favs.find(f => f.is_crown && f.title_id !== t.id)?.title_id;
          await saveFavorites(t.kind, ids, crown);
        }
        saved = true; close(); toast('انحفظ ✓');
      } catch (x) { console.error(x); err('ما انحفظ، جرّب مرة ثانية.'); btn.disabled = false; }
    };
    el.querySelector('[data-del]')?.addEventListener('click', async ev => {
      if (!armed(ev.currentTarget)) return;
      try {
        await deleteEntry(t.id);
        if (isFav) await saveFavorites(t.kind, favs.map(f => f.title_id).filter(id => id !== t.id), favs.find(f => f.is_crown && f.title_id !== t.id)?.title_id);
        saved = true; close(); toast('انحذف');
      } catch (x) { err('ما انحذف، جرّب مرة ثانية.'); }
    });
  });
}

// one-tap status change from title pages / search (keeps rating, review, etc.)
export async function quickStatus(t, status) {
  if (!requireAuth()) return false;
  const cur = me.entries.get(t.id);
  await saveEntry(t.id, { status, date: status === 'wish' ? null : (cur?.date || today()), rating: cur?.rating || 0 });
  toast(`${KINDS[t.kind][status]} ✓`);
  return true;
}
