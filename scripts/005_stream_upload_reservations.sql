-- OPTIONAL migration: run manually in a Supabase STAGING project before enabling uploads.
-- No existing videos, RLS policies, or profile data are modified.
create table if not exists public.stream_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stream_uid text unique,
  created_at timestamptz not null default now(),
  constraint stream_uid_format check (stream_uid is null or stream_uid ~ '^[a-f0-9]{32}$')
);

create index if not exists stream_uploads_user_created_idx
  on public.stream_uploads (user_id, created_at desc);

alter table public.stream_uploads enable row level security;
revoke all on public.stream_uploads from anon, authenticated;
grant select on public.stream_uploads to authenticated;

drop policy if exists stream_uploads_owner_read on public.stream_uploads;
create policy stream_uploads_owner_read on public.stream_uploads
  for select to authenticated using ((select auth.uid()) = user_id);

-- The advisory lock makes daily reservations atomic even if the user opens
-- multiple tabs. Every reservation counts for 24h, including API failures,
-- to avoid unlimited Cloudflare capacity reservations.
create or replace function public.reserve_stream_upload()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare caller uuid := auth.uid();
declare reservation uuid;
begin
  if caller is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(caller::text));
  if (select count(*) from public.stream_uploads
      where user_id = caller and created_at > pg_catalog.now() - interval '24 hours') >= 5 then
    raise exception 'upload_daily_limit' using errcode = 'P0001';
  end if;
  insert into public.stream_uploads(user_id) values (caller) returning id into reservation;
  return reservation;
end
$$;

-- An owner can attach a returned Cloudflare UID once. The status endpoint
-- separately verifies Cloudflare's creator and reservation metadata.
create or replace function public.attach_stream_upload(p_id uuid, p_uid text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_uid is null or p_uid !~ '^[a-f0-9]{32}$' then
    return false;
  end if;
  update public.stream_uploads
    set stream_uid = p_uid
    where id = p_id and user_id = caller and stream_uid is null;
  return found;
end
$$;

revoke all on function public.reserve_stream_upload() from public, anon;
revoke all on function public.attach_stream_upload(uuid,text) from public, anon;
grant execute on function public.reserve_stream_upload() to authenticated;
grant execute on function public.attach_stream_upload(uuid,text) to authenticated;
