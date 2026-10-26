# Cargo photo upload & provider review

Traders attach a photograph of their cargo to a booking; the provider on that
booking approves or rejects it. Review is **advisory** — it never blocks a
booking status transition, so a shipment can never get stuck waiting for a
photo decision.

## Data model

`supabase/migrations/0002_cargo_photo_review.sql` (additive — `0001_init.sql`
is already applied and is left untouched) adds to `public.bookings`:

| column | type | meaning |
| --- | --- | --- |
| `cargo_photo_path` | `text` | object path in the `cargo-photos` bucket, `<booking-id>/<stamp>-<rand>.<ext>` |
| `cargo_photo_label` | `text` | trader-entered description |
| `cargo_photo_bytes` | `bigint` | stored file size |
| `cargo_photo_uploaded_at` | `timestamptz` | submission time |
| `review_status` | `text` | `null` (no photo) / `pending` / `approved` / `rejected` |
| `review_note` | `text` | rejection reason (required when rejecting) |
| `reviewed_at` | `timestamptz` | decision time |
| `reviewer_id` | `text` | provider/admin who decided |

A `check` constraint restricts `review_status`, and `bookings_review_idx`
(`provider_id`, `review_status`) backs the review queue.

## Storage

The migration also creates the private bucket **`cargo-photos`**
(3 MiB limit, `image/jpeg` / `image/png` / `image/webp`).

Access is decided by the `storage.objects` policies, which call
`public.can_access_cargo_photo(name)`. The function is `SECURITY DEFINER` and
allows a request when either:

- the caller is the trader or the provider on the booking whose id is the first
  path segment, or
- the caller's profile row has `role = 'admin'`.

`select`, `insert`, `update` and `delete` are all scoped by that function, so a
user outside the booking cannot list, read, upload into, or delete its objects.
Reads go through short-lived signed URLs minted server-side
(`src/server/services/storage.ts`); object paths are never handed to the client.

## Server rules (`src/server/services/cargo.ts`)

Enforced on the server, never in the browser:

- only the booking's trader (or an admin) may upload or replace a photo;
- no upload once a booking is `cancelled` or `delivered`;
- an `approved` photo is immutable — the provider must reopen it first;
- only the booking's provider (or an admin) may decide;
- only a `pending` photo can be decided, which also prevents duplicate
  approve/reject races after the first decision;
- a decided photo can be **reopened** by that booking's provider (or an admin):
  the status returns to `pending` and the note/reviewer are cleared, while the
  stored image is kept until the trader replaces it;
- a rejection always carries a note;
- the payload is re-validated: declared MIME type, real image signature
  (JPEG/PNG/WebP) and a 3 MiB ceiling;
- replacing a photo deletes the superseded object;
- each step writes an audit event and notifies the counterparty.

## UI

- `src/components/cargo-photo.tsx` — one dialog for both sides (upload/replace
  for the trader, approve/reject for the provider) plus the status pill.
- `src/routes/bookings.tsx` — per-booking "Cargo photo" column and entry point.
- `src/routes/cargo-review.tsx` — provider queue (`/cargo-review`), split into
  *Awaiting review* and *History*; the tab follows the record you just changed.
- `src/lib/module-nav.ts` — role-scoped navigation; the *Cargo review* entry
  carries a live badge with the number of photos awaiting that provider.
- `src/lib/api.ts` — `announceCargoChange()` broadcasts a `trh:cargo-changed`
  event after any photo change, so the badge and lists refresh without polling.
- `src/lib/image.ts` — browser-side downscale to 1600 px and JPEG re-encode so
  phone photos fit the upload limit. The server re-checks everything.

## Setup

1. Apply the migration (idempotent, safe to re-run):

   ```sh
   node scripts/apply-migration.mjs supabase/migrations/0002_cargo_photo_review.sql
   ```

   It uses the direct Postgres connection from `.env`
   (`SUPABASE_URL`, `SUPABASE_PASSWD`) and falls back to the Supavisor pooler
   when the direct host is unreachable (IPv6-only projects).

2. Nothing else — the bucket and policies are part of the same migration, and no
   service-role key is required at runtime: uploads and signed URLs are made with
   the caller's own token, so the policies apply.

If the bucket is missing, uploads fail with
`Cargo photo storage is not provisioned — apply supabase/migrations/0002_cargo_photo_review.sql.`

## What was verified

Against the live project database, as the seeded demo users:

- trader upload → `pending`; photo renders from a signed URL (1200×800 uploaded
  file round-tripped);
- provider queue shows the item for the booking's provider only; an unrelated
  provider sees an empty queue;
- reject without a note → server error `Add a short reason…`;
- reject with a note → status `rejected`, note stored, notification emitted;
- a decided photo offers no decide buttons (re-decision requires resubmission);
- trader resubmits → status back to `pending`, note/reviewer cleared, previous
  object deleted (bucket holds exactly one object);
- provider approves → `approved`, reviewer recorded;
- provider reopens the approved photo → status back to `pending`, decision and
  reviewer cleared, image kept, audit event `booking.cargo_photo.reopen` and a
  notification to the trader; the queue badge reappears;
- storage policy, tested with real GoTrue tokens: booking trader ✅, booking
  provider ✅, admin ✅, other provider ❌ (`Object not found` on read, RLS error
  on upload into that folder), other trader ❌;
- service layer, replayed with a trader token: review queue → `FORBIDDEN`;
  upload for another trader's booking → `FORBIDDEN`; replacing an approved photo
  → `PHOTO_ALREADY_REVIEWED`.

## Limitations

- **Single photo per booking.** A replacement overwrites the previous one; there
  is no gallery or history of earlier frames.
- **No real-time push.** The provider sees new submissions on page load or via
  *Refresh*; the queue is not subscribed to changes.
- **Reopen is one booking at a time**, and only the booking's provider or an
  admin can do it — there is no bulk reopen or scheduled expiry of approvals.
- **Base64 upload path.** Photos travel through the server function body, hence
  the 3 MiB cap and in-browser downscale. Direct-to-storage signed uploads would
  allow larger originals.
- **No image moderation or OCR.** Content is not analysed; only the file type and
  signature are checked.
- **Deletion is not exposed.** There is no "remove photo" action; objects are
  only replaced or left in place.
