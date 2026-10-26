-- Transit Route Hub — cargo photo upload + provider review.
--
-- 0001_init.sql is already applied and must not be edited, so the cargo-photo
-- columns land here instead. Everything is additive — existing bookings keep
-- `cargo_photo_path = null` / `review_status = null`, which means "no photo was
-- required for this shipment" and leaves the booking workflow untouched.
--
-- Review lifecycle (mirrors src/domain/types.ts):
--   null      → no photo submitted (photo is optional)
--   pending   → trader submitted a photo, provider has not decided yet
--   approved  → provider accepted the photo
--   rejected  → provider rejected it with a note; the trader may resubmit
--
-- Review status is advisory: it never blocks a booking transition, so no
-- booking can become stuck waiting for a review. The server enforces that a
-- rejection always carries a note and that a decided photo can only be
-- re-decided after a resubmission (see src/server/services/cargo.ts).

alter table if exists public.bookings
  add column if not exists cargo_photo_path   text,
  add column if not exists cargo_photo_label  text,
  add column if not exists cargo_photo_bytes  bigint,
  add column if not exists cargo_photo_uploaded_at timestamptz,
  add column if not exists review_status      text,
  add column if not exists review_note        text not null default '',
  add column if not exists reviewed_at        timestamptz,
  add column if not exists reviewer_id        text references public.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_review_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_review_status_check
      check (review_status is null or review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists bookings_review_idx
  on public.bookings (provider_id, review_status);

-- ---------------------------------------------------------------------------
-- Auth linkage used by the storage policies below.
--
-- App profiles keep their own text id (`usr-…`) and store the Supabase Auth
-- user id separately. scripts/db-setup.mjs normally creates this column; the
-- statement is repeated here (idempotently) so the storage policies can also be
-- applied to a database that was built from the SQL migrations alone.
-- ---------------------------------------------------------------------------

alter table if exists public.users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id);

-- ---------------------------------------------------------------------------
-- Private storage bucket for cargo photographs.
--
-- Objects are keyed by booking: `<booking-id>/<timestamp>-<random>.jpg`. The
-- bucket is private, so every read goes through a short-lived signed URL minted
-- on the server for an authorized caller (src/server/services/storage.ts).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cargo-photos',
  'cargo-photos',
  false,
  3145728, -- 3 MiB: keeps the base64 upload inside server-function body limits
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/**
 * True when the caller (identified by their Supabase Auth JWT) is a party to the
 * booking named by the object's first path segment, or is an administrator.
 * SECURITY DEFINER so the storage policy does not depend on RLS round-trips.
 */
create or replace function public.can_access_cargo_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.bookings b
      join public.users u
        on u.id = b.user_id or u.id = b.provider_id
      where b.id = split_part(object_name, '/', 1)
        -- auth_user_id is the normal link; u.id covers a database where the
        -- profile id still equals the auth user id (see 0001_init.sql).
        and (u.auth_user_id = auth.uid() or u.id = auth.uid()::text)
    )
    or exists (
      select 1
      from public.users u
      where u.role = 'admin'
        and (u.auth_user_id = auth.uid() or u.id = auth.uid()::text)
    );
$$;

revoke all on function public.can_access_cargo_photo(text) from public;
grant execute on function public.can_access_cargo_photo(text) to anon, authenticated;

drop policy if exists "cargo photos read" on storage.objects;
create policy "cargo photos read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cargo-photos' and public.can_access_cargo_photo(name));

drop policy if exists "cargo photos insert" on storage.objects;
create policy "cargo photos insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cargo-photos' and public.can_access_cargo_photo(name));

drop policy if exists "cargo photos update" on storage.objects;
create policy "cargo photos update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'cargo-photos' and public.can_access_cargo_photo(name))
  with check (bucket_id = 'cargo-photos' and public.can_access_cargo_photo(name));

drop policy if exists "cargo photos delete" on storage.objects;
create policy "cargo photos delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'cargo-photos' and public.can_access_cargo_photo(name));
