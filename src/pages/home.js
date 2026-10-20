import { $, esc } from '../lib/util.js';
import { KINDS } from '../lib/kinds.js';
import { discover } from '../lib/catalog.js';
import { sb, q } from '../lib/supabase.js';
import { me } from '../lib/store.js';
import { activity, recentReviews, T } from '../lib/db.js';
import { card, row, sh, skelRow, feedItem, reviewList, loading, footer } from '../ui/components.js';

const KINDS3 = ['games', 'movies', 'shows'];

async function trendingRows(ctx) {
  for (const k of KINDS3) {
    discover(k, 'trending').then(list => {
      if (!ctx.alive()) return;
      const el = $('tr-' + k); if (el) el.innerHTML = row(list.slice(0, 16).map(t => card(t, { caption: true })), 'ما فيه شي');
    }).catch(() => { const el = $('tr-' + k); if (el) el.innerHTML = '<div class="empty">ما قدرنا نجيب الرائج الحين.</div>'; });
  }
}
const trendingHtml = () => KINDS3.map(k => `<section data-kind-sec="${k}">${sh(`رائج في ${KINDS[k].name}`, `<a href="/explore/${k}" data-link>الكل ‹</a>`)}<div id="tr-${k}">${skelRow()}</div></section>`).join('');

export async function homePage(_, ctx) {
  document.getElementById('app').dataset.kind = 'games';
  if (!me.user) return landing(ctx);
  const p = me.profile;
  $('view').innerHTML = `<div class="wrap page">
    <div><h1 class="ptitle">هلا ${esc(p.display_name || p.username)} 👋</h1><p class="psub">وش لعبت أو شفت مؤخراً؟</p></div>
    <div class="layout" style="padding:0">
      <main>
        <section>${sh('نشاط اللي تتابعهم', `<a href="/members" data-link>دوّر أصدقاء ‹</a>`)}<div id="feed">${loading()}</div></section>
        ${trendingHtml()}
      </main>
      <aside>
        <section>${sh('شائع في رفّ')}<div id="pop">${loading()}</div></section>
        <section>${sh('مراجعات مشهورة')}<div id="poprev">${loading()}</div></section>
      </aside>
    </div></div>${footer()}`;
  trendingRows(ctx);
  const ids = [...me.following];
  activity(ids, 30).then(list => {
    if (!ctx.alive()) return;
    $('feed').innerHTML = list.length ? `<div class="feed">${list.map(feedItem).join('')}</div>`
      : `<div class="empty">${ids.length ? 'ما سجّلوا شي للحين.' : 'تابع ناس من <a href="/members" data-link style="color:var(--accent)">الأعضاء</a> عشان يطلع نشاطهم هنا.'}</div>`;
  });
  popular(ctx);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  recentReviews({ popular: true, since, limit: 5 }).then(list => {
    if (!ctx.alive()) return;
    $('poprev').innerHTML = list.length ? reviewList(list, { clamp: true }) : '<div class="empty">ما فيه مراجعات للحين.</div>';
  });
}

async function popular(ctx) {
  const list = await q(sb.from('popular_titles').select(T + ',recent_logs').order('recent_logs', { ascending: false }).limit(9)).catch(() => []);
  if (!ctx.alive()) return;
  $('pop').innerHTML = list.length ? `<div class="posters" style="grid-template-columns:repeat(3,1fr)">${list.map(t => card(t)).join('')}</div>` : '<div class="empty">أول ما الأعضاء يسجّلون، يطلع هنا الأكثر تسجيلاً.</div>';
}

function landing(ctx) {
  $('view').innerHTML = `<div class="wrap page">
    <section class="hero"><div class="hero-bg"></div>
      <span class="dots"><i></i><i></i><i></i></span>
      <h1>رفّك لكل اللي لعبته وشفته.</h1>
      <p>سجّل ألعابك وأفلامك ومسلسلاتك والأنمي، قيّمها واكتب مراجعاتك، سوّ قوائمك، وتابع أصدقاءك وشوف وش يلعبون ويشوفون.</p>
      <div class="hero-act"><a class="btn primary" href="/signup" data-link>سوّ حسابك مجاناً</a><a class="btn" href="/login" data-link>عندي حساب</a></div>
    </section>
    <div class="feats">
      <div class="feat"><b>🎮 🎬 📺 كل شي في مكان واحد</b><span>ألعاب من RAWG، وأفلام ومسلسلات وأنمي من TMDB، مع البوسترات الحقيقية.</span></div>
      <div class="feat"><b>⭐ قيّم وراجع</b><span>تقييم من نص نجمة لخمس، ومراجعات يقدر الكل يقراها ويعطيها لايك.</span></div>
      <div class="feat"><b>👑 مفضلاتك وقوائمك</b><span>أفضل خمسة لكل نوع، وتاج لأحسنها، وقوائم مرتّبة تشاركها.</span></div>
      <div class="feat"><b>👥 تابع أصدقاءك</b><span>صفحة عامة لكل عضو، وشوف نشاط اللي تتابعهم أول بأول.</span></div>
    </div>
    ${trendingHtml()}
    <section>${sh('آخر المراجعات')}<div id="lrev">${loading()}</div></section>
  </div>${footer()}`;
  trendingRows(ctx);
  recentReviews({ limit: 6 }).then(list => {
    if (!ctx.alive()) return;
    $('lrev').innerHTML = list.length ? reviewList(list) : '<div class="empty">كن أول واحد يكتب مراجعة.</div>';
  }).catch(() => { $('lrev').innerHTML = ''; });
}
