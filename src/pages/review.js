// A single review: full text, likes (and who liked it), comments.
import { $, esc, stars, ago, fmtDate, toast } from '../lib/util.js';
import { label } from '../lib/kinds.js';
import { sb, q } from '../lib/supabase.js';
import { me } from '../lib/store.js';
import { E, U } from '../lib/db.js';
import { cover, av, uname, likeBtn, loading, footer, sh } from '../ui/components.js';
import { armed } from '../ui/modal.js';
import { requireAuth } from '../ui/auth-gate.js';

export async function reviewPage({ id }, ctx) {
  $('view').innerHTML = `<div class="wrap page">${loading()}</div>`;
  const e = /^[0-9a-f-]{36}$/.test(id) ? await q(sb.from('entries').select(E).eq('id', id).maybeSingle()) : null;
  if (!ctx.alive()) return;
  if (!e || !e.review) { $('view').innerHTML = '<div class="wrap page"><div class="empty">المراجعة مو موجودة أو انحذفت.</div></div>'; return; }
  const t = e.title, u = e.user;
  document.getElementById('app').dataset.kind = t.kind;
  document.title = `مراجعة ${u.display_name || u.username} لـ ${t.title} — رفّ`;
  $('view').innerHTML = `<div class="wrap page" style="max-width:820px">
    <article class="rcard" style="grid-template-columns:120px 1fr;border:0">
      <a href="/t/${t.id}" data-link>${cover(t, { status: e.status })}</a>
      <div>
        <div class="rhead"><a class="u" href="/u/${esc(u.username)}" data-link>${av(u, 28)}${uname(u)}</a><span>${esc(label(t.kind, e.status, me.user?.id === e.user_id))}</span></div>
        <h1 class="ptitle" style="margin-top:6px"><a href="/t/${t.id}" data-link>${esc(t.title)}</a> ${t.year ? `<small style="color:var(--dim);font-size:16px">${t.year}</small>` : ''}</h1>
        <div class="rhead" style="margin-top:6px"><span class="stars" style="font-size:18px">${stars(e.rating)}</span>${e.date ? `<span>${fmtDate(e.date)}</span>` : ''}${e.platform ? `<span>على ${esc(e.platform)}</span>` : ''}${e.spoiler ? '<span class="spoil-tag">فيها حرق</span>' : ''}</div>
        <p class="rbody${e.spoiler ? ' spoil' : ''}" ${e.spoiler ? 'data-spoil' : ''} style="font-size:16px" dir="auto">${esc(e.review)}</p>
        <div class="rfoot" style="margin-top:16px">${likeBtn(e, true)}<span id="likers"></span></div>
      </div>
    </article>
    <section>${sh(`التعليقات · <span id="cN">${e.comments_count}</span>`)}<div class="comments" id="cms">${loading()}</div>
      ${me.user ? `<form class="cform" id="cForm" style="margin-top:12px"><textarea name="body" maxlength="1000" placeholder="اكتب تعليق…" required></textarea><div><button class="btn primary">علّق</button></div></form>`
        : '<p class="hint" style="margin-top:12px"><a href="/login" data-link style="color:var(--accent)">سجّل دخولك</a> عشان تعلّق أو تعطي لايك.</p>'}
    </section></div>${footer()}`;

  q(sb.from('review_likes').select(`created_at, user:profiles!user_id(${U})`).eq('entry_id', e.id).order('created_at', { ascending: false }).limit(12)).then(l => {
    if (!ctx.alive() || !l.length) return;
    $('likers').innerHTML = `<span style="display:flex;align-items:center;gap:4px">عجبت: ${l.slice(0, 6).map(x => `<a href="/u/${esc(x.user.username)}" data-link title="${esc(x.user.display_name || x.user.username)}">${av(x.user, 28)}</a>`).join('')}${e.likes_count > 6 ? ` +${e.likes_count - 6}` : ''}</span>`;
  });

  async function loadComments() {
    const list = await q(sb.from('comments').select(`id, body, created_at, user_id, user:profiles!user_id(${U})`).eq('entry_id', e.id).order('created_at').limit(300));
    if (!ctx.alive()) return;
    $('cN').textContent = list.length;
    $('cms').innerHTML = list.length ? list.map(c => `<div class="cm"><a href="/u/${esc(c.user.username)}" data-link>${av(c.user, 36)}</a>
      <div><a href="/u/${esc(c.user.username)}" data-link><b>${uname(c.user)}</b></a> <small>${ago(c.created_at)}</small><p dir="auto">${esc(c.body)}</p></div>
      ${me.user && (me.user.id === c.user_id || me.user.id === e.user_id) ? `<button class="xbtn" type="button" data-delc="${c.id}">حذف</button>` : '<span></span>'}</div>`).join('')
      : '<div class="empty">ما فيه تعليقات للحين.</div>';
  }
  loadComments();
  $('cms').onclick = async ev => {
    const b = ev.target.closest('[data-delc]'); if (!b || !armed(b, 'متأكد؟')) return;
    try { await q(sb.from('comments').delete().eq('id', b.dataset.delc)); loadComments(); } catch { toast('ما انحذف'); }
  };
  $('cForm')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!requireAuth()) return;
    const f = ev.target, body = f.body.value.trim(); if (!body) return;
    f.querySelector('.btn').disabled = true;
    try { await q(sb.from('comments').insert({ entry_id: e.id, user_id: me.user.id, body })); f.reset(); loadComments(); }
    catch { toast('ما انرسل، جرّب مرة ثانية'); }
    f.querySelector('.btn').disabled = false;
  });
}
