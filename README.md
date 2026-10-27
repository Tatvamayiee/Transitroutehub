# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
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

## Feature docs

- [Cargo photo upload & provider review](docs/cargo-photo-review.md) — schema,
  private storage bucket and policies, server rules, the archived history of
  replaced photographs, and known limitations.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
