# Cargo photo upload & provider review

Traders attach a photograph of their cargo to a booking; the provider on that
booking approves or rejects it. Review is **advisory** — it never blocks a
booking status transition, so a shipment can never get stuck waiting for a
photo decision.

## Data model

`supabase/migrations/0002_cargo_photo_review.sql` (additive — `0001_init.sql`
is already applied and is left untouched) adds to `public.bookings`:

| column                    | type          | meaning                                                                       |
| ------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `cargo_photo_path`        | `text`        | object path in the `cargo-photos` bucket, `<booking-id>/<stamp>-<rand>.<ext>` |
| `cargo_photo_label`       | `text`        | trader-entered description                                                    |
| `cargo_photo_bytes`       | `bigint`      | stored file size                                                              |
| `cargo_photo_uploaded_at` | `timestamptz` | submission time                                                               |
| `review_status`           | `text`        | `null` (no photo) / `pending` / `approved` / `rejected`                       |
| `review_note`             | `text`        | rejection reason (required when rejecting)                                    |
| `reviewed_at`             | `timestamptz` | decision time                                                                 |
| `reviewer_id`             | `text`        | provider/admin who decided                                                    |

A `check` constraint restricts `review_status`, and `bookings_review_idx`
(`provider_id`, `review_status`) backs the review queue.

### Earlier versions

`supabase/migrations/0003_cargo_photo_history.sql` adds
`public.cargo_photo_history` — one row per **superseded** photograph, so a
provider (or an admin) can compare the newest submission against what came
before instead of losing every earlier frame.

| column          | type          | meaning                                                                             |
| --------------- | ------------- | ----------------------------------------------------------------------------------- |
| `id`            | `text`        | `cph-…`                                                                             |
| `booking_id`    | `text`        | booking the version belonged to (`on delete cascade`)                               |
| `path`          | `text`        | storage object path of the superseded photo                                         |
| `label`         | `text`        | label the trader gave at the time                                                   |
| `bytes`         | `bigint`      | stored file size                                                                    |
| `uploaded_at`   | `timestamptz` | when that version was submitted                                                     |
| `superseded_at` | `timestamptz` | when it stopped being the current one                                               |
| `reason`        | `text`        | `replaced` (trader uploaded a new frame) / `reopened` (provider cleared a decision) |
| `review_status` | `text`        | decision the photo had at that moment (`pending` / `approved` / `rejected`)         |
| `review_note`   | `text`        | the note that decision carried                                                      |
| `reviewed_at`   | `timestamptz` | decision time                                                                       |
| `reviewer_id`   | `text`        | provider/admin who decided                                                          |

A unique index on `(booking_id, path)` makes the archive idempotent: the object
path is unique per upload, so a version can never be archived twice. That is what
lets a _reopen_ archive the photo (keeping the decision it clears) and the later
_replacement_ of that same object archive nothing, instead of overwriting the
recorded decision.

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
- a superseded photo is **archived, not deleted**: the object stays in the
  private bucket and a `cargo_photo_history` row records its label, size, the
  review state (status, note, reviewer) it had when it left the current slot and
  why it left (`replaced` or `reopened`) — the archive write is best-effort and
  logs a warning rather than failing the trader's upload;
- the history is readable by the booking's trader, its provider and admins
  (`cargoPhotoHistory`), and no one else;
- each step writes an audit event and notifies the counterparty.

## UI

- `src/components/cargo-photo.tsx` — one dialog for both sides (upload/replace
  for the trader, approve/reject for the provider) plus the status pill. It also
  loads the archived versions when it opens: a _Previous submissions_ strip of
  thumbnails, each labelled with when it was superseded, the decision it got and
  the note/reviewer behind it. Selecting one swaps it into the preview pane
  (caption _Earlier version · superseded …_) so the two can be compared by eye,
  and _Back to current_ returns to the live submission.
- `src/routes/cargo-review.tsx` / `src/routes/bookings.tsx` — the queue card and
  the bookings table show how many earlier versions exist, from the batched
  `cargoPhotoHistoryCount` on each view, so the compare affordance is visible
  before the dialog is opened.
- `src/routes/bookings.tsx` — per-booking "Cargo photo" column and entry point.
- `src/routes/cargo-review.tsx` — provider queue (`/cargo-review`), split into
  _Awaiting review_ and _History_; the tab follows the record you just changed.
- `src/lib/module-nav.ts` — role-scoped navigation; the _Cargo review_ entry
  carries a live badge with the number of photos awaiting that provider.
- `src/lib/api.ts` — `announceCargoChange()` broadcasts a `trh:cargo-changed`
  event after any photo change, so the badge and lists refresh without polling.
- `src/lib/image.ts` — browser-side downscale to 1600 px and JPEG re-encode so
  phone photos fit the upload limit. The server re-checks everything.

## Setup

1. Apply the migrations in order (idempotent, safe to re-run):

   ```sh
   node scripts/apply-migration.mjs supabase/migrations/0002_cargo_photo_review.sql
   node scripts/apply-migration.mjs supabase/migrations/0003_cargo_photo_history.sql
   ```

   They use the direct Postgres connection from `.env`
   (`SUPABASE_URL`, `SUPABASE_PASSWD`) and fall back to the Supavisor pooler
   when the direct host is unreachable (IPv6-only projects).

   `0003` repeats the permissive `app_all` policy (`to anon, authenticated`,
   `using (true)`) that `scripts/db-setup.mjs` applies to every app table:
   Supabase's `ensure_rls` event trigger turns row-level security on for new
   tables in `public`, and authorization for this schema lives in the services,
   so the anon transport role must not be denied. Applying the migration alone
   therefore leaves the table usable.

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
- trader resubmits → status back to `pending`, note/reviewer cleared, and the
  superseded frame archived in `cargo_photo_history` instead of being deleted;
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

The history added in `0003` is covered by `scripts/verify-cargo-history.ts`
(`npx --yes vite-node@3 scripts/verify-cargo-history.ts` — 34 checks, all
passing against the live database), which walks a real booking through
replace → reject → reopen → replace → approve → reopen → replace and then puts
the original photograph back:

- a replacement archives the previous version with its label, size and the
  decision it had; the superseded object stays in the bucket and is readable by
  the trader **and** the booking's provider through a signed URL, while an
  unrelated provider cannot mint one;
- a reopen archives the photo it is about to clear, so the history keeps
  `rejected` + note + reviewer even if the trader never resubmits; the photo
  stays attached and still counts as the current one;
- replacing an already-archived version adds no duplicate row and does not
  overwrite the decision recorded earlier; an approved version keeps
  `approved` + reviewer in the history after a later replacement;
- history reads: trader ✅, provider ✅, admin ✅, other trader ❌, other provider ❌
  (`FORBIDDEN`), invalid token ❌ (`UNAUTHORIZED`), unknown booking ❌ (`NOT_FOUND`);
- the review queue and bookings list expose the archived count
  (`cargoPhotoHistoryCount`) that the UI uses as its compare hint.

In the browser (dev server, signed in as the demo provider and the demo trader):
opening a booking with four archived versions shows the _Previous submissions_
strip, every thumbnail and the preview load from signed URLs; selecting
one swaps the preview to that earlier frame with the caption
_Earlier version · superseded …_ and _Back to current_ restores the live photo;
the queue card and the bookings row both read "4 earlier versions"; no console or
network errors.

## Limitations

- **One current photo per booking.** Earlier frames are kept as history
  thumbnails for comparison, but the workflow still has a single live photograph;
  there is no free-form gallery, captions per version or delete/restore of an
  individual archived frame.
- **No real-time push.** The provider sees new submissions on page load or via
  _Refresh_; the queue is not subscribed to changes.
- **Reopen is one booking at a time**, and only the booking's provider or an
  admin can do it — there is no bulk reopen or scheduled expiry of approvals.
- **Base64 upload path.** Photos travel through the server function body, hence
  the 3 MiB cap and in-browser downscale. Direct-to-storage signed uploads would
  allow larger originals.
- **No image moderation or OCR.** Content is not analysed; only the file type and
  signature are checked.
- **Deletion is not exposed.** There is no "remove photo" action: objects are
  only superseded or left in place, and superseded objects are now retained for
  the history (roughly one 3 MiB object per replacement, readable only through a
  signed URL). The archive itself is capped at the 20 newest versions per
  booking in `listCargoPhotoHistory`; older rows are kept but not shown.
- **History writes are best-effort.** The service logs a warning instead of
  failing an upload if the archive insert errors (for example before `0003` is
  applied), so a missing archive row would go unnoticed rather than block a
  trader.
