// Demo build only: starting data. Your account comes pre-filled with the real (non-example) items from the
// old page; the other members and everything they wrote are made up so the social parts have something to show.
import { ALL } from './catalog-data.js';
import legacy from '../src/legacy.json';

export const DEMO_EMAIL = 'demo@raff.app';
export const DEMO_PASSWORD = '123456';

export function seed(uuid) {
  const ago = d => new Date(Date.now() - d * 864e5).toISOString();
  const day = d => ago(d).slice(0, 10);
  const byTitle = t => ALL.find(x => x.title.toLowerCase() === t.toLowerCase());
  const db = { users: [], profiles: [], titles: [], entries: [], favorites: [], lists: [], list_items: [], follows: [], review_likes: [], list_likes: [], comments: [], media: {} };
  const title = t => {
    if (!db.titles.some(x => x.id === t.id)) db.titles.push({ id: t.id, kind: t.kind, title: t.title, year: t.year, poster: null, backdrop: null, by: t.by, genres: t.genres, platforms: t.platforms || [], sub: t.sub || null, about: null, updated_at: ago(30) });
    return t.id;
  };
  const person = (username, display_name, bio, email, password = 'demo1234') => {
    const id = uuid();
    db.users.push({ id, email, password });
    db.profiles.push({ id, username, display_name, bio, avatar_url: null, banner_url: null, created_at: ago(90) });
    return id;
  };
  const entry = (user_id, name, status, rating, daysAgo, review = null) => {
    const t = byTitle(name); if (!t) throw new Error('seed: no title ' + name);
    const e = {
      id: uuid(), user_id, title_id: title(t), kind: t.kind, status, rating, date: status === 'wish' ? null : day(daysAgo), platform: null,
      review, spoiler: false, reviewed_at: review ? ago(daysAgo) : null, likes_count: 0, comments_count: 0, created_at: ago(daysAgo), updated_at: ago(daysAgo)
    };
    db.entries.push(e); return e;
  };
  const like = (user_id, e) => { db.review_likes.push({ user_id, entry_id: e.id, created_at: ago(1) }); e.likes_count++; };
  const comment = (user_id, e, body, d = 1) => { db.comments.push({ id: uuid(), entry_id: e.id, user_id, body, created_at: ago(d) }); e.comments_count++; };
  const follow = (a, b, d = 5) => db.follows.push({ follower_id: a, following_id: b, created_at: ago(d) });

  /* you: the old page's real items */
  const me = person('Abdulaziz771', legacy.profile?.name || 'Abdulaziz771', legacy.profile?.bio || '', DEMO_EMAIL, DEMO_PASSWORD);
  const oldToNew = new Map();
  for (const it of legacy.items.filter(i => !i.ex)) {
    const t = byTitle(it.title); if (!t) continue;
    title(t);
    const e = { id: uuid(), user_id: me, title_id: t.id, kind: t.kind, status: it.status, rating: +it.rating || 0, date: it.date || null, platform: null,
      review: it.review || null, spoiler: false, reviewed_at: it.review ? ago(3) : null, likes_count: 0, comments_count: 0, created_at: ago(20), updated_at: (it.date ? it.date + 'T12:00:00.000Z' : ago(20)) };
    db.entries.push(e); oldToNew.set(it.id, t.id);
  }
  ['games', 'movies', 'shows'].forEach(k => legacy.items.filter(i => !i.ex && i.kind === k && i.fav && oldToNew.has(i.id)).slice(0, 5)
    .forEach((i, position) => db.favorites.push({ user_id: me, kind: k, position, title_id: oldToNew.get(i.id), is_crown: false })));
  for (const l of legacy.lists) {
    const id = uuid();
    db.lists.push({ id, user_id: me, kind: l.kind, title: l.title, description: l.desc || '', ranked: true, likes_count: 0, created_at: ago(10), updated_at: ago(10) });
    l.items.map(x => oldToNew.get(x)).filter(Boolean).forEach((title_id, position) => db.list_items.push({ list_id: id, title_id, position }));
  }

  /* made-up members */
  const sara = person('sara_x', 'سارة', 'أنمي أكثر من النوم 😴', 'sara@demo.app');
  const fahad = person('fahad_gg', 'فهد', 'سولزلايك وبس', 'fahad@demo.app');
  const noura = person('noura', 'نورة', 'أفلام وقهوة ☕', 'noura@demo.app');
  const majed = person('majed99', 'ماجد', '', 'majed@demo.app');

  const r1 = entry(fahad, 'Elden Ring', 'done', 5, 2, 'أفضل عالم مفتوح لعبته. كل زاوية فيها سر، والبوسات تتعبك بس تستاهل.');
  entry(fahad, 'Sekiro: Shadows Die Twice', 'done', 5, 40);
  entry(fahad, 'Bloodborne', 'done', 4.5, 120);
  entry(fahad, 'Black Myth: Wukong', 'playing', 0, 1);
  entry(fahad, 'Hollow Knight: Silksong', 'wish', 0, 3);
  const r2 = entry(fahad, 'Persona 5 Royal', 'done', 4, 30, 'الستايل خرافي والموسيقى ما تطلع من راسي، بس الحين طويلة شوي.');
  const r3 = entry(sara, 'Frieren: Beyond Journey\'s End', 'done', 5, 4, 'هادي وحزين وجميل. من أحلى الأنمي اللي شفتها من سنين.');
  entry(sara, 'Jujutsu Kaisen', 'done', 4, 25);
  entry(sara, 'Dandadan', 'playing', 0, 1);
  entry(sara, 'Spirited Away', 'done', 5, 200);
  const r4 = entry(sara, 'Persona 5 Royal', 'done', 5, 12, 'لعبتها مرتين وما مليت. فريق الفانتوم ثيفز أحسن شلة.');
  entry(sara, 'Chainsaw Man', 'paused', 0, 15);
  const r5 = entry(noura, 'Dune: Part Two', 'done', 4.5, 6, 'الصوت والتصوير على مستوى ثاني. لازم ينشاف في السينما.');
  entry(noura, 'Past Lives', 'done', 4.5, 50);
  entry(noura, 'Perfect Days', 'done', 5, 80, 'فيلم بسيط عن الأيام العادية، وطلعت منه مرتاحة.');
  entry(noura, 'Severance', 'playing', 0, 2);
  entry(noura, 'Sinners', 'wish', 0, 1);
  const r6 = entry(majed, 'Hades', 'done', 4.5, 9, 'كل محاولة تحس إنك تتطور. القصة تنحكى وأنت تموت 😂');
  entry(majed, 'Balatro', 'playing', 0, 1);
  entry(majed, 'Castlevania: Aria of Sorrow', 'done', 4, 60);
  entry(majed, 'Breaking Bad', 'done', 5, 300);

  like(sara, r1); like(noura, r1); like(majed, r1);
  like(fahad, r3); like(noura, r3);
  like(fahad, r4); like(majed, r4); like(me, r4);
  like(sara, r5); like(fahad, r6);
  comment(sara, r1, 'مالينيا ذبحتني 50 مرة 😭', 1);
  comment(majed, r1, 'وش البلد اللي تبدأ فيها؟');
  comment(fahad, r4, 'اتفق، أفضل جزء بالسلسلة.', 2);

  follow(sara, me, 3); follow(fahad, me, 6);
  follow(me, sara, 6); follow(me, fahad, 7);
  follow(sara, fahad); follow(noura, sara); follow(majed, fahad); follow(fahad, sara);

  const sl = uuid();
  db.lists.push({ id: sl, user_id: sara, kind: 'shows', title: 'أنمي لازم تشوفه', description: 'لو بتبدأ أنمي، ابدأ من هنا.', ranked: true, likes_count: 1, created_at: ago(8), updated_at: ago(8) });
  ['Frieren: Beyond Journey\'s End', 'Fullmetal Alchemist: Brotherhood', 'Steins;Gate', 'Vinland Saga', 'Cowboy Bebop'].forEach((n, position) => db.list_items.push({ list_id: sl, title_id: title(byTitle(n)), position }));
  db.list_likes.push({ user_id: fahad, list_id: sl, created_at: ago(2) });
  return db;
}
