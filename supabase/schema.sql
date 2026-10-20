-- رفّ — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to run once on a fresh project.

create extension if not exists citext;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_url text,
  banner_url text,
  created_at timestamptz not null default now()
);

-- ============ catalog cache (written only by the server with the service key) ============
create table public.titles (
  id text primary key check (id ~ '^[gms][0-9]+$'),   -- g = RAWG game, m = TMDB movie, s = TMDB tv
  kind text not null check (kind in ('games','movies','shows')),
  title text not null,
  original_title text,
  year int,
  poster text,
  backdrop text,
  by text,            -- developer / director / network
  genres text[] not null default '{}',
  platforms text[] not null default '{}',
  sub text,           -- 'أنمي' | 'مسلسل' for shows
  about text,
  updated_at timestamptz not null default now()
);

-- ============ entries: one per user per title (status, rating, review) ============
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_id text not null references public.titles(id) on delete cascade,
  kind text not null check (kind in ('games','movies','shows')),
  status text not null check (status in ('done','played','playing','paused','dropped','wish')),
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5 and rating * 2 = floor(rating * 2)),
  date date,
  platform text check (char_length(platform) <= 40),
  review text check (char_length(review) <= 5000),
  spoiler boolean not null default false,
  reviewed_at timestamptz,
  likes_count int not null default 0,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
);
create index entries_user_idx on public.entries(user_id, kind);
create index entries_title_idx on public.entries(title_id);
create index entries_updated_idx on public.entries(updated_at desc);
create index entries_reviews_idx on public.entries(reviewed_at desc) where review is not null;

-- ============ favourites (max 5 per kind) + crown ============
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('games','movies','shows')),
  position smallint not null check (position between 0 and 4),
  title_id text not null references public.titles(id) on delete cascade,
  is_crown boolean not null default false,
  primary key (user_id, kind, position),
  unique (user_id, title_id)
);

-- ============ lists ============
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('games','movies','shows')),
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  ranked boolean not null default true,
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_user_idx on public.lists(user_id);

create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  title_id text not null references public.titles(id) on delete cascade,
  position int not null,
  primary key (list_id, title_id)
);

-- ============ social ============
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);

create table public.review_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index review_likes_entry_idx on public.review_likes(entry_id);

create table public.list_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_entry_idx on public.comments(entry_id, created_at);

-- ============ triggers ============
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
-- likes/comments counters don't count as an edit, so they don't bump an entry up the feed
create or replace function public.touch_entry() returns trigger language plpgsql as $$
begin
  if (new.status, new.rating, new.date, new.platform, new.review, new.spoiler)
     is distinct from (old.status, old.rating, old.date, old.platform, old.review, old.spoiler) then
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger entries_touch before update on public.entries for each row execute function public.touch_entry();
create trigger lists_touch before update on public.lists for each row execute function public.touch();

-- keep reviewed_at in sync; the entry's kind always follows its title
create or replace function public.entries_prepare() returns trigger language plpgsql as $$
begin
  new.review := nullif(btrim(coalesce(new.review, '')), '');
  if new.review is null then new.reviewed_at := null;
  elsif tg_op = 'INSERT' or old.review is distinct from new.review or old.reviewed_at is null then new.reviewed_at := now();
  end if;
  select kind into new.kind from public.titles where id = new.title_id;
  return new;
end $$;
create trigger entries_prepare before insert or update on public.entries for each row execute function public.entries_prepare();

create or replace function public.bump_review_likes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update entries set likes_count = likes_count + 1 where id = new.entry_id;
  else update entries set likes_count = greatest(likes_count - 1, 0) where id = old.entry_id; end if;
  return null;
end $$;
create trigger review_likes_count after insert or delete on public.review_likes for each row execute function public.bump_review_likes();

create or replace function public.bump_list_likes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update lists set likes_count = likes_count + 1 where id = new.list_id;
  else update lists set likes_count = greatest(likes_count - 1, 0) where id = old.list_id; end if;
  return null;
end $$;
create trigger list_likes_count after insert or delete on public.list_likes for each row execute function public.bump_list_likes();

create or replace function public.bump_comments() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update entries set comments_count = comments_count + 1 where id = new.entry_id;
  else update entries set comments_count = greatest(comments_count - 1, 0) where id = old.entry_id; end if;
  return null;
end $$;
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_comments();

-- the counters above are maintained by triggers only; users can't write them directly
create or replace function public.guard_counters() returns trigger language plpgsql as $$
begin
  if current_user in ('anon','authenticated') then
    new.likes_count := old.likes_count;
    if tg_table_name = 'entries' then new.comments_count := old.comments_count; end if;
  end if;
  return new;
end $$;
create trigger entries_guard before update on public.entries for each row execute function public.guard_counters();
create trigger lists_guard before update on public.lists for each row execute function public.guard_counters();

-- create a profile for every new auth user (username comes from sign-up metadata)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'user'), '[^A-Za-z0-9_]', '', 'g');
  uname text;
begin
  if char_length(base) < 3 then base := base || 'user'; end if;
  base := left(base, 16);
  uname := base;
  while exists (select 1 from profiles where username = uname::citext) loop
    uname := base || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into profiles (id, username, display_name)
  values (new.id, uname, left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', uname), 40));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.username_available(name text) returns boolean language sql stable security definer set search_path = public as $$
  select name ~ '^[A-Za-z0-9_]{3,20}$' and not exists (select 1 from profiles where username = name::citext);
$$;

-- ============ stats views ============
create view public.title_stats with (security_invoker = true) as
select title_id,
  count(*) filter (where status <> 'wish') as logs,
  count(*) filter (where status = 'wish') as wishes,
  count(*) filter (where status = 'playing') as playing,
  count(*) filter (where review is not null) as reviews,
  count(*) filter (where rating > 0) as ratings,
  round(avg(rating) filter (where rating > 0), 2) as avg_rating,
  array[
    count(*) filter (where rating = 0.5), count(*) filter (where rating = 1), count(*) filter (where rating = 1.5),
    count(*) filter (where rating = 2), count(*) filter (where rating = 2.5), count(*) filter (where rating = 3),
    count(*) filter (where rating = 3.5), count(*) filter (where rating = 4), count(*) filter (where rating = 4.5),
    count(*) filter (where rating = 5)
  ] as hist
from public.entries group by title_id;

create view public.profile_stats with (security_invoker = true) as
select p.id,
  (select count(*) from public.entries e where e.user_id = p.id and e.status <> 'wish') as logs,
  (select count(*) from public.entries e where e.user_id = p.id and e.review is not null) as reviews,
  (select count(*) from public.follows f where f.following_id = p.id) as followers,
  (select count(*) from public.follows f where f.follower_id = p.id) as following,
  (select coalesce(sum(e.likes_count), 0) from public.entries e where e.user_id = p.id) as likes_received
from public.profiles p;

-- titles ranked by how many members logged them recently
create view public.popular_titles with (security_invoker = true) as
select t.*, s.n as recent_logs
from (select title_id, count(*) as n from public.entries where updated_at > now() - interval '30 days' group by title_id) s
join public.titles t on t.id = s.title_id;

-- ============ row level security: everything is publicly readable, only the owner writes ============
alter table public.profiles enable row level security;
alter table public.titles enable row level security;
alter table public.entries enable row level security;
alter table public.favorites enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.follows enable row level security;
alter table public.review_likes enable row level security;
alter table public.list_likes enable row level security;
alter table public.comments enable row level security;

create policy "read" on public.profiles for select using (true);
create policy "own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "read" on public.titles for select using (true);

create policy "read" on public.entries for select using (true);
create policy "own insert" on public.entries for insert with check (auth.uid() = user_id);
create policy "own update" on public.entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.entries for delete using (auth.uid() = user_id);

create policy "read" on public.favorites for select using (true);
create policy "own insert" on public.favorites for insert with check (auth.uid() = user_id);
create policy "own update" on public.favorites for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.favorites for delete using (auth.uid() = user_id);

create policy "read" on public.lists for select using (true);
create policy "own insert" on public.lists for insert with check (auth.uid() = user_id);
create policy "own update" on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.lists for delete using (auth.uid() = user_id);

create policy "read" on public.list_items for select using (true);
create policy "own write" on public.list_items for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

create policy "read" on public.follows for select using (true);
create policy "own insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "own delete" on public.follows for delete using (auth.uid() = follower_id);

create policy "read" on public.review_likes for select using (true);
create policy "own insert" on public.review_likes for insert with check (
  auth.uid() = user_id and not exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "own delete" on public.review_likes for delete using (auth.uid() = user_id);

create policy "read" on public.list_likes for select using (true);
create policy "own insert" on public.list_likes for insert with check (
  auth.uid() = user_id and not exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "own delete" on public.list_likes for delete using (auth.uid() = user_id);

create policy "read" on public.comments for select using (true);
create policy "own insert" on public.comments for insert with check (auth.uid() = user_id);
-- the comment's author or the review's owner can delete it
create policy "delete" on public.comments for delete using (
  auth.uid() = user_id or exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()));

grant execute on function public.username_available(text) to anon, authenticated;

-- ============ storage: avatars and banners ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media own update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
