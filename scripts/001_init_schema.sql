-- Nexa production schema (profiles, videos, social graph, stories, messaging, notifications)
-- Apply via the Supabase MCP once the database connection is available.

-- =============================================================
-- PROFILES  (public mirror of auth.users)
-- =============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  is_verified boolean not null default false,
  follower_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- =============================================================
-- VIDEOS (reels)
-- =============================================================
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  thumbnail_url text,
  description text,
  music text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.videos enable row level security;

drop policy if exists "videos_select_all" on public.videos;
create policy "videos_select_all" on public.videos for select using (true);

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own" on public.videos for insert with check (auth.uid() = user_id);

drop policy if exists "videos_update_own" on public.videos;
create policy "videos_update_own" on public.videos for update using (auth.uid() = user_id);

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own" on public.videos for delete using (auth.uid() = user_id);

create index if not exists videos_user_id_idx on public.videos(user_id);
create index if not exists videos_created_at_idx on public.videos(created_at desc);

-- =============================================================
-- LIKES
-- =============================================================
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.likes enable row level security;

drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all" on public.likes for select using (true);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.videos v where v.id = likes.video_id)
);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes for delete using (auth.uid() = user_id);

-- =============================================================
-- FOLLOWS
-- =============================================================
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all" on public.follows for select using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows for insert with check (
  auth.uid() = follower_id
  and exists (select 1 from public.profiles p where p.id = follows.following_id)
);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- =============================================================
-- COMMENTS
-- =============================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all" on public.comments for select using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.videos v where v.id = comments.video_id)
);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments for update using (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments for delete using (auth.uid() = user_id);

create index if not exists comments_video_id_idx on public.comments(video_id);

-- =============================================================
-- STORIES (24h ephemeral)
-- =============================================================
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.stories enable row level security;

drop policy if exists "stories_select_active" on public.stories;
create policy "stories_select_active" on public.stories for select using (expires_at > now());

drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own" on public.stories for insert with check (auth.uid() = user_id);

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories for delete using (auth.uid() = user_id);

create index if not exists stories_expires_at_idx on public.stories(expires_at);

-- =============================================================
-- CONVERSATIONS + MESSAGES
-- =============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a <> user_b),
  unique (user_a, user_b)
);

alter table public.conversations enable row level security;

drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member" on public.conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "conversations_insert_member" on public.conversations;
create policy "conversations_insert_member" on public.conversations for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','voice','view-once','system')),
  content text,
  media_url text,
  duration_sec integer,
  is_opened boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Only conversation members can read/write messages.
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages for insert with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

drop policy if exists "messages_update_member" on public.messages;
create policy "messages_update_member" on public.messages for update using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow','mention','live','system')),
  video_id uuid references public.videos(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = recipient_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = recipient_id);

drop policy if exists "notifications_insert_any" on public.notifications;
create policy "notifications_insert_any" on public.notifications for insert with check (auth.uid() = actor_id);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- =============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'مستخدم جديد'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- COUNTER MAINTENANCE (likes / follows / comments)
-- =============================================================
create or replace function public.bump_like_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT') then
    update public.videos set like_count = like_count + 1 where id = new.video_id;
  elsif (tg_op = 'DELETE') then
    update public.videos set like_count = greatest(like_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end; $$;

drop trigger if exists likes_count_trg on public.likes;
create trigger likes_count_trg after insert or delete on public.likes
  for each row execute function public.bump_like_count();

create or replace function public.bump_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT') then
    update public.videos set comment_count = comment_count + 1 where id = new.video_id;
  elsif (tg_op = 'DELETE') then
    update public.videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end; $$;

drop trigger if exists comments_count_trg on public.comments;
create trigger comments_count_trg after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

create or replace function public.bump_follow_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
  end if;
  return null;
end; $$;

drop trigger if exists follows_count_trg on public.follows;
create trigger follows_count_trg after insert or delete on public.follows
  for each row execute function public.bump_follow_counts();
