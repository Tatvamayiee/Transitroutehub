-- Transit Route Hub — history of replaced cargo photos.
--
-- 0002_cargo_photo_review.sql added the single "current photo" columns to
-- `bookings` and deleted the superseded storage object on replacement. That made
-- a re-shoot destructive: the provider could only ever judge the newest frame and
-- had nothing to compare it against. This migration adds the archive that records
-- every superseded version.
--
-- Design notes:
--   * one row per superseded storage object, keyed by (booking_id, path). The
--     object path is unique per upload, so a photo can never be archived twice;
--   * the row carries the review state the photo had when it was superseded, so
--     "rejected — the seals are not visible" survives into the history;
--   * a reopen archives the photo *before* its decision is cleared, which is what
--     the unique index is for: when the trader later replaces that same object the
--     insert is skipped and the original decision is preserved;
--   * the storage object is now retained (0002 deleted it) so the history can
--     render thumbnails. Objects still live under `<booking-id>/`, so the storage
--     policies from 0002 (`can_access_cargo_photo`) already allow the booking's
--     trader, its provider and admins to read them — nothing to change there.
--
-- Access is server-mediated like every other table in this schema (no RLS on app
-- tables); src/server/services/cargo.ts authorizes the caller first.
--
-- Additive: existing bookings simply have no history rows.

create table if not exists public.cargo_photo_history (
  id            text primary key,
  booking_id    text not null references public.bookings (id) on delete cascade,
  -- Storage object path of the superseded photo, kept so it stays displayable.
  path          text not null,
  label         text not null default '',
  bytes         bigint,
  uploaded_at   timestamptz not null,
  superseded_at timestamptz not null,
  -- 'replaced' = the trader uploaded a new frame; 'reopened' = the provider cleared
  -- a decision, keeping the image attached until it is replaced.
  reason        text not null default 'replaced'
                check (reason in ('replaced', 'reopened')),
  review_status text check (review_status is null or review_status in ('pending', 'approved', 'rejected')),
  review_note   text not null default '',
  reviewed_at   timestamptz,
  reviewer_id   text references public.users (id) on delete set null
);

-- One archive row per superseded object; makes the archive idempotent (see above).
create unique index if not exists cargo_photo_history_path_key
  on public.cargo_photo_history (booking_id, path);

create index if not exists cargo_photo_history_booking_idx
  on public.cargo_photo_history (booking_id, superseded_at desc);

comment on table public.cargo_photo_history is
  'Superseded cargo photographs per booking. The current photo lives on bookings; every earlier version is archived here so providers and admins can compare submissions. Objects are retained in the private cargo-photos bucket.';

-- ---------------------------------------------------------------------------
-- RLS: Supabase's `ensure_rls` event trigger switches row-level security ON for
-- every new table in `public`, and this schema carries the permissive `app_all`
-- policy on each app table (scripts/db-setup.mjs). Authorization lives in the
-- services, so RLS must not silently deny the anon transport role. Repeated here
-- so applying this migration on its own leaves the table usable.
-- ---------------------------------------------------------------------------

alter table public.cargo_photo_history enable row level security;

drop policy if exists app_all on public.cargo_photo_history;
create policy app_all on public.cargo_photo_history
  to anon, authenticated
  using (true)
  with check (true);
