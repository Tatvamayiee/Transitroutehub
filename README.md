# Transit Route Hub

A marketplace for containerised freight capacity. Logistics providers publish
scheduled lanes and the container volume on them; traders search that space,
book the cubic metres they need, fund escrow, and both sides then work the
shipment through to delivery.

Modules: dashboard, routes & containers, capacity aggregation, booking
management, escrow payments, cargo-photo upload and provider review, a 3D load
planner, messaging, provider verification, reports and an admin console. The
`trader`, `provider` and `admin` roles each see only the modules they can use.

Everything is enforced server-side: authentication runs against Supabase Auth,
row-level security and storage policies scope the data, and each server function
re-checks ownership, permissions and input before it writes.

## Development

You need Node.js and npm.

```sh
git clone https://github.com/Tatvamayiee/Transitroutehub.git
cd Transitroutehub
npm install
cp .env.example .env   # then fill in SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Database migrations

`supabase/migrations/` holds the schema. `0001_init.sql` is already applied and
must not be edited — add a new numbered file instead, then apply it with:

```sh
node scripts/apply-migration.mjs supabase/migrations/0002_cargo_photo_review.sql
node scripts/apply-migration.mjs supabase/migrations/0003_cargo_photo_history.sql
```

Every migration is written to be idempotent, so re-running it is safe. The
script connects with `SUPABASE_URL` / `SUPABASE_PASSWD` from `.env` and falls
back to the Supavisor pooler when the direct host is IPv6-only.

## Money

Amounts are stored as plain numbers and quoted in **rupees**: `payments.currency`
records `INR`, and every figure is rendered through `formatMoney`
([src/lib/money.ts](src/lib/money.ts)), which prefixes `₹` and groups digits the
Indian way (`₹12,34,567.50`). Formatting is hand-rolled rather than left to
`Intl.NumberFormat` so server and client render identical text.

## Feature docs

- [Cargo photo upload & provider review](docs/cargo-photo-review.md) — schema,
  private storage bucket and policies, server rules, the archived history of
  replaced photographs, and known limitations.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
