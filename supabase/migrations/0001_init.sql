-- Transit Route Hub — initial schema.
-- Mirrors the in-memory store contract (src/server/store.ts) 1:1 so services
-- keep their domain shapes. IDs are text with semantic prefixes (usr-, bk-…).
--
-- Authentication is handled by Supabase Auth (GoTrue): credentials and
-- sessions live there, so this schema keeps only the app profile row.
-- users.id references auth.users(id) — created on first sign-in/sign-up.

create table if not exists users (
  id         text primary key, -- = auth.users.id
  email      text not null unique,
  name       text not null,
  company    text not null,
  role       text not null check (role in ('trader', 'provider', 'admin')),
  created_at timestamptz not null
);

create table if not exists lanes (
  id           text primary key,
  provider_id  text not null references users (id),
  origin       text not null,
  destination  text not null,
  mode         text not null check (mode in ('road', 'rail', 'sea', 'air')),
  scheduled_at timestamptz not null,
  created_at   timestamptz not null
);

create table if not exists containers (
  id            text primary key,
  provider_id   text not null references users (id),
  lane_id       text not null references lanes (id),
  label         text not null,
  capacity_m3   double precision not null,
  available_m3  double precision not null,
  price_per_m3  double precision not null,
  status        text not null check (status in ('available', 'booked', 'inactive')),
  created_at    timestamptz not null
);

create index if not exists containers_lane_idx on containers (lane_id);

create table if not exists bookings (
  id           text primary key,
  user_id      text not null references users (id),
  provider_id  text not null references users (id),
  container_id text not null references containers (id),
  requested_m3 double precision not null,
  status       text not null check (status in ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  created_at   timestamptz not null,
  updated_at   timestamptz not null
);

create index if not exists bookings_user_idx on bookings (user_id);
create index if not exists bookings_provider_idx on bookings (provider_id);
create index if not exists bookings_container_idx on bookings (container_id);

create table if not exists cargo_boxes (
  id         text primary key,
  booking_id text not null references bookings (id) on delete cascade,
  label      text not null,
  length_cm  double precision not null,
  width_cm   double precision not null,
  height_cm  double precision not null,
  weight_kg  double precision not null,
  fragile    boolean not null default false,
  hue        integer not null default 0,
  placement  jsonb -- {xCm, yCm, zCm, rotated}; null while not loaded
);

create index if not exists cargo_boxes_booking_idx on cargo_boxes (booking_id);

create table if not exists payments (
  id          text primary key,
  booking_id  text not null unique references bookings (id),
  trader_id   text not null references users (id),
  provider_id text not null references users (id),
  amount      double precision not null,
  currency    text not null,
  status      text not null check (status in ('unfunded', 'funded', 'released', 'refunded')),
  created_at  timestamptz not null,
  updated_at  timestamptz not null
);

create table if not exists threads (
  id          text primary key,
  booking_id  text not null unique references bookings (id) on delete cascade,
  trader_id   text not null references users (id),
  provider_id text not null references users (id),
  created_at  timestamptz not null
);

create table if not exists messages (
  id          text primary key,
  thread_id   text not null references threads (id) on delete cascade,
  sender_id   text not null,
  sender_name text not null,
  body        text not null,
  created_at  timestamptz not null
);

create index if not exists messages_thread_idx on messages (thread_id, created_at);

create table if not exists notifications (
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  kind       text not null check (kind in ('booking', 'payment', 'verification', 'system')),
  title      text not null,
  body       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists verifications (
  id              text primary key,
  provider_id     text not null unique references users (id),
  legal_name      text not null,
  registration_no text not null,
  tax_id          text not null,
  contact_email   text not null,
  contact_phone   text not null,
  fleet_size      integer not null,
  document_refs   text not null,
  status          text not null check (status in ('unverified', 'pending', 'approved', 'rejected')),
  submitted_at    timestamptz not null,
  reviewed_at     timestamptz,
  reviewer_id     text references users (id),
  review_note     text not null default ''
);

create table if not exists audit_events (
  id         text primary key,
  actor_id   text not null,
  actor_name text not null,
  action     text not null,
  target     text not null,
  at         timestamptz not null
);

create index if not exists audit_events_at_idx on audit_events (at desc);
