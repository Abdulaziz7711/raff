// One-time move of the data that lived inside the old single-file page into the signed-in account.
// Each old title is matched against RAWG / TMDB; you can fix a match or skip an item before importing.
import { $, esc, stars, toast } from '../lib/util.js';
import { KINDS } from '../lib/kinds.js';
import { search, ensureTitle } from '../lib/catalog.js';
import { sb, q } from '../lib/supabase.js';
import { me, saveEntry } from '../lib/store.js';
import { saveFavorites, myFavorites } from '../lib/db.js';
import { cover } from '../ui/components.js';
import { requireAuth } from '../ui/auth-gate.js';
import { navigate } from '../lib/router.js';
import { invalidateProfile } from './profile.js';
import legacy from '../legacy.json';

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
function best(item, results) {
  const n = norm(item.title);
  const exact = results.filter(r => norm(r.title) === n);
  const pool = exact.length ? exact : results.filter(r => norm(r.title).includes(n) || n.includes(norm(r.title)));
  // when the old item says it was finished in year Y, prefer a release that's not after Y
  const y = item.date ? +item.date.slice(0, 4) : null;
  return (pool.find(r => !y || !r.year || r.year <= y) || pool[0] || results[0])?.id || '';
}

export async function importPage(_, ctx) {
  if (!requireAuth()) return;
  document.getElementById('app').dataset.kind = 'games';
  document.title = 'نقل البيانات — رفّ';
  const items = legacy.items;
  $('view').innerHTML = `<div class="wrap page" style="max-width:860px">
    <div><h1 class="ptitle">نقل بياناتك القديمة</h1>
      <p class="psub">هذي البيانات اللي كانت محفوظة في نسخة «رفّ» القديمة. طابقنا كل عنوان مع مصدره الحقيقي؛ شيك على المطابقة وغيّرها إذا طلعت غلط، وبعدين اضغط «انقل».</p>
      <p class="hint">العناصر اللي كانت «مثال» في النسخة القديمة ما هي محددة؛ حددها إذا تبيها.</p></div>
    <div class="imp" id="rows">${items.map((it, ix) => `<div class="imp-row" data-ix="${ix}">
      <input type="checkbox" ${it.ex ? '' : 'checked'} aria-label="انقل">
      <div><b>${esc(it.title)}</b><small>${esc(KINDS[it.kind].name)} · ${esc(KINDS[it.kind][it.status])}${it.rating ? ` · <span class="stars">${stars(it.rating)}</span>` : ''}${it.date ? ` · ${it.date}` : ''}${it.fav ? ' · 👑 مفضلة' : ''}${it.review ? ' · فيه مراجعة' : ''}${it.ex ? ' · مثال' : ''}</small></div>
      <div class="imp-match"><span data-cov><div class="cover skel"></div></span><select disabled><option>يدوّر…</option></select></div></div>`).join('')}</div>
    <div class="card-box"><b>القوائم: ${legacy.lists.map(l => `«${esc(l.title)}»`).join('، ') || 'ما فيه'}</b><p class="hint">تنتقل بنفس الترتيب، بالعناصر اللي حددتها فوق.</p></div>
    <div><button class="btn primary" id="go" disabled>انقل لحسابي</button> <span id="st" class="hint"></span></div>
  </div>`;

  const matches = items.map(() => ({ results: [], id: '' }));
  const rowEl = ix => $('rows').querySelector(`[data-ix="${ix}"]`);
  const drawRow = ix => {
    const m = matches[ix], el = rowEl(ix), sel = el.querySelector('select');
    sel.disabled = false;
    sel.innerHTML = m.results.map(r => `<option value="${r.id}" ${r.id === m.id ? 'selected' : ''}>${esc(r.title)}${r.year ? ` (${r.year})` : ''}</option>`).join('') + `<option value="" ${m.id ? '' : 'selected'}>— ما لقيته / تجاهل —</option>`;
    const r = m.results.find(x => x.id === m.id);
    el.querySelector('[data-cov]').innerHTML = r ? cover(r) : '<div class="cover"></div>';
  };
  // a few searches at a time so RAWG/TMDB don't rate-limit us
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const ix = next++, it = items[ix];
      try { matches[ix].results = (await search(it.kind, it.title)).slice(0, 8); matches[ix].id = best(it, matches[ix].results); } catch { }
      if (!ctx.alive()) return;
      drawRow(ix);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (!ctx.alive()) return;
  $('go').disabled = false;
  $('rows').onchange = e => {
    const row = e.target.closest('[data-ix]'); if (!row || e.target.tagName !== 'SELECT') return;
    const ix = +row.dataset.ix; matches[ix].id = e.target.value; drawRow(ix);
  };

  $('go').onclick = async () => {
    $('go').disabled = true;
    const st = t => { $('st').textContent = t; };
    const chosen = new Map(); // old id -> title id
    const picked = items.map((it, ix) => ({ it, ix })).filter(({ it, ix }) => rowEl(ix).querySelector('input').checked && matches[ix].id);
    let n = 0, failed = 0;
    for (const { it, ix } of picked) {
      st(`ينقل ${++n} من ${picked.length}…`);
      const tid = matches[ix].id;
      try {
        await saveEntry(tid, { status: it.status, rating: +it.rating || 0, date: it.date || null, review: it.review || null });
        chosen.set(it.id, tid);
      } catch (e) { console.error(e); failed++; }
    }
    try {
      // favourites: keep whatever is already there, then the old ones, up to 5 per kind
      for (const k of Object.keys(KINDS)) {
        const old = items.filter(i => i.kind === k && i.fav && chosen.has(i.id)).map(i => chosen.get(i.id));
        if (!old.length) continue;
        const cur = await myFavorites(k);
        const ids = [...new Set([...cur.map(f => f.title_id), ...old])].slice(0, 5);
        await saveFavorites(k, ids, cur.find(f => f.is_crown)?.title_id);
      }
      st('ينقل القوائم…');
      const existing = await q(sb.from('lists').select('title').eq('user_id', me.user.id));
      for (const l of legacy.lists) {
        if (existing.some(x => x.title === l.title)) continue;
        const ids = l.items.map(id => chosen.get(id)).filter(Boolean);
        const row = await q(sb.from('lists').insert({ user_id: me.user.id, kind: l.kind, title: l.title, description: l.desc || '', ranked: true }).select('id').single());
        for (const id of ids) await ensureTitle(id);
        if (ids.length) await q(sb.from('list_items').insert(ids.map((title_id, position) => ({ list_id: row.id, title_id, position }))));
      }
      if (legacy.profile?.bio && !me.profile.bio) await q(sb.from('profiles').update({ bio: legacy.profile.bio }).eq('id', me.user.id));
    } catch (e) { console.error(e); failed++; }
    invalidateProfile();
    toast(failed ? `انتقل الأغلب، وفيه ${failed} ما انتقل` : 'انتقل كل شي ✓');
    navigate(`/u/${me.profile.username}`);
  };
}
