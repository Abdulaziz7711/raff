// The original "ابحث" window, now backed by RAWG / TMDB. Used by the + سجّل button and by "add to list".
import { esc } from '../lib/util.js';
import { KINDS, KIND_NAME } from '../lib/kinds.js';
import { search } from '../lib/catalog.js';
import { me } from '../lib/store.js';
import { cover } from './components.js';
import { openModal } from './modal.js';
import { openLog, quickStatus } from './logModal.js';
import { navigate, reload } from '../lib/router.js';

export function srow(r, ix) {
  const have = me.entries.get(r.id);
  return `<button class="srow" type="button" data-pick="${ix}">${cover(r)}
    <span><b>${esc(r.title)}</b><small>${esc([r.year, r.sub && r.kind === 'shows' ? r.sub : '', (r.genres || []).join('، ')].filter(Boolean).join(' · '))}</small></span>
    ${have ? `<span class="have">عندك ✓</span>` : ''}</button>`;
}

export function openSearch({ q = '', kind = 'games', onPick, title = 'ابحث' } = {}) {
  let sKind = kind, results = [], ctl = null;
  const { el, close } = openModal(`
    <div data-s1 style="display:grid;gap:12px">
      <h3>${esc(title)}</h3>
      <form class="sbar"><input name="q" placeholder="اسم اللعبة أو الفيلم أو المسلسل…" autocomplete="off" enterkeyhint="search" value="${esc(q)}" autofocus><button class="btn primary">بحث</button></form>
      <div class="chips" data-kinds style="margin:0"></div>
      <div data-res><div class="sstate">اكتب الاسم واضغط بحث</div></div>
    </div>
    <div data-s2 hidden style="display:grid;gap:14px"></div>
    <div class="m-actions"><span></span><button type="button" class="btn" data-close>إغلاق</button></div>`, { width: 560 });
  const $s = s => el.querySelector(s);
  const kinds = () => { $s('[data-kinds]').innerHTML = (onPick ? [kind] : Object.keys(KINDS)).map(k => `<button class="chip" type="button" data-sk="${k}" aria-pressed="${sKind === k}">${KIND_NAME[k]}</button>`).join(''); };
  kinds();

  async function run() {
    const v = $s('[name=q]').value.trim(); if (!v) return;
    ctl?.abort(); ctl = new AbortController();
    $s('[data-res]').innerHTML = '<div class="sstate">يدوّر…</div>';
    try {
      results = await search(sKind, v, { signal: ctl.signal });
      $s('[data-res]').innerHTML = results.length ? `<div class="sres">${results.map(srow).join('')}</div>` : '<div class="sstate">ما لقيت شي بهالاسم. جرّب تكتبه بطريقة ثانية أو بالإنجليزي.</div>';
    } catch (e) {
      if (e.name === 'AbortError') return;
      $s('[data-res]').innerHTML = '<div class="sstate">صار خطأ في البحث، جرّب مرة ثانية.</div>';
    }
  }
  $s('form').onsubmit = e => { e.preventDefault(); run(); };
  $s('[data-kinds]').onclick = e => { const b = e.target.closest('[data-sk]'); if (!b) return; sKind = b.dataset.sk; kinds(); run(); };
  $s('[data-res]').onclick = e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const r = results[+b.dataset.pick];
    if (onPick) { close(); onPick(r); return; }
    detail(r);
  };
  function detail(r) {
    const have = me.entries.get(r.id), K = KINDS[r.kind];
    $s('[data-s2]').innerHTML = `<button type="button" class="linkbtn" data-back>‹ رجوع للنتائج</button>
      <div class="detail">${cover(r)}<div><h3>${esc(r.title)}</h3><div class="dmeta">
        ${r.year ? `<span>السنة: <b>${esc(r.year)}</b></span>` : ''}
        ${r.genres?.length ? `<span>الجانرا: <b>${esc(r.genres.join('، '))}</b></span>` : ''}
        ${r.platforms?.length ? `<span>المنصات: <b>${esc(r.platforms.join('، '))}</b></span>` : ''}</div>
        <p class="dabout"><a href="/t/${r.id}" data-open style="color:var(--accent)">صفحة ${K.unit} كاملة ‹</a></p></div></div>
      <div class="dact">${have
        ? `<button class="btn primary" type="button" data-log>تعديل تسجيلي</button><span class="have" style="align-self:center">عندك: ${esc(K[have.status])}</span>`
        : `<button class="btn primary" type="button" data-log>سجّل</button><button class="btn" type="button" data-wish>+ ${esc(K.list)}</button>`}</div>`;
    $s('[data-s1]').hidden = true; $s('[data-s2]').hidden = false;
    $s('[data-s2]').onclick = async e => {
      if (e.target.closest('[data-back]')) { $s('[data-s2]').hidden = true; $s('[data-s1]').hidden = false; return; }
      if (e.target.closest('[data-open]')) { e.preventDefault(); close(); navigate(`/t/${r.id}`); return; }
      if (e.target.closest('[data-log]')) { close(); if (await openLog(r)) reload(); return; }
      if (e.target.closest('[data-wish]')) { close(); if (await quickStatus(r, 'wish')) reload(); }
    };
  }
  if (q) run();
  return close;
}
