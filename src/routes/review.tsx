import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Code & Architecture Review — Transit Route Hub" },
      {
        name: "description",
        content: "Production-grade code and architecture review for Transit Route Hub.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Production Code &amp; Architecture Review
        </h1>
        <p className="mt-1 text-muted-foreground">
          Transit Route Hub · TanStack Start · TypeScript · React 19
        </p>
      </header>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="font-semibold text-lg">Executive Summary</h2>
        <p className="mt-2 text-muted-foreground">
          This is a TanStack Start + React 19 + TypeScript frontend shell (Transit Route Hub) with
          client-side auth, localStorage persistence, and a polished shadcn/ui surface. The platform
          is currently a frontend-only prototype: there is no backend, no database, no server
          functions, and no server authority over identity. Critical credentials (salted SHA-256
          password hashes) and all user records live in the browser's localStorage, which blocks
          multi-tenant persistence, secure credential storage, rate limiting, and any
          server-rendered private data.
        </p>
        <p className="mt-2 text-muted-foreground">
          The header advertises nine "coming soon" modules (containers, bookings, payments,
          notifications, admin, reports, and more). The scaffold is high quality, but the auth model
          must be hardened and backed by a real backend before production use.
        </p>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold text-lg">1. Architecture &amp; Design Patterns</h2>
          <h3 className="mt-3 font-medium text-foreground">Current architecture</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>TanStack Start (SSR/RSC-capable) with Vite bundler</li>
            <li>TanStack Router (file-based, typed navigation)</li>
            <li>React 19 + Radix primitives + Tailwind v4</li>
            <li>Auth: in-memory store + localStorage, client-only</li>
            <li>Data: no server DB, no API — all state is in-browser</li>
            <li>Error handling: custom h3 SSR error normalization + React error boundary</li>
          </ul>
          <h3 className="mt-3 font-medium text-foreground">Strengths</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>Type-safe routing and navigation</li>
            <li>Clean separation of route components from shared UI primitives</li>
            <li>Thoughtful SSR error recovery (h3 swallowed-error detection)</li>
            <li>Solid React error boundary + telemetry bridge for Lovable</li>
            <li>Consistent, reusable component surface</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold text-lg">Key architectural gaps</h2>
          <div className="mt-2 space-y-4">
            <div className="flex gap-3">
              <span className="shrink-0 text-red-400 text-base leading-none mt-0.5">1</span>
              <div>
                <p className="font-medium">No backend / no server authority</p>
                <p className="text-muted-foreground text-sm">
                  All persistence is localStorage. No DB, no API, no server functions for mutations.
                  This blocks multi-device sync, concurrency, security enforcement, and
                  server-rendered private data.
                  <strong className="text-foreground">Recommendation:</strong> Add a backend. Given
                  the stack, TanStack Start server functions + a real DB (D1/SQLite or managed
                  Postgres/Data Connect) is the most natural fit.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 text-amber-400 text-base leading-none mt-0.5">2</span>
              <div>
                <p className="font-medium">Business logic mixed into UI and client store</p>
                <p className="text-muted-foreground text-sm">
                  Auth rules (hashing, duplicate checks, login) live in{" "}
                  <code className="text-amber-300 bg-amber-900/20 px-1 rounded text-xs">
                    src/lib/auth.ts
                  </code>{" "}
                  alongside React hooks and persistence. No domain/service layer exists.{" "}
                  <strong className="text-foreground">Recommendation:</strong> extract a pure domain
                  module (entities, validation, rules) that server and client can share; move
                  credential handling to the server and keep client state as a thin view model.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 text-amber-400 text-base leading-none mt-0.5">3</span>
              <div>
                <p className="font-medium">Placeholder feature surface, no wiring</p>
                <p className="text-muted-foreground text-sm">
                  Nine "coming soon" modules render in the header, but no data models, routes, or
                  APIs exist for containers, bookings, payments, notifications, or admin tooling.
                  Treat these as the real roadmap and design the data model and multi-role
                  permissions now.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold text-lg">2. Code Quality &amp; Maintainability</h2>
          <h3 className="mt-3 font-medium text-foreground">Good patterns</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>
              Strict TS config: noPropertyAccessFromIndexSignature, noUncheckedIndexedAccess,
              exactOptionalPropertyTypes, noFallthroughCasesInSwitch, noImplicitReturns,
              noImplicitOverride
            </li>
            <li>Client-side form validation (email regex, password length/match)</li>
            <li>Idempotent logout and redirect guards on the dashboard</li>
            <li>Auth state as a single source of truth with subscribe / hydrate / persist</li>
            <li>Error capture expands cause chains and caps expansion size</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold text-lg">Concerns</h2>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>
              <strong className="text-red-400">Exposed password hash.</strong> The User type
              includes passwordHash and it is stored in localStorage. Even hashed, this is
              unnecessary client exposure and increases XSS impact.
            </li>
            <li>
              <strong className="text-red-400">Weak password hashing.</strong> SHA-256 with a
              hardcoded static salt is not appropriate for credentials; use bcrypt/Argon2 with
              per-user salts server-side.
            </li>
            <li>
              <strong className="text-amber-400">No typed contract for auth results.</strong>{" "}
              Functions return ad-hoc result shapes — consider a discriminated union or
              Zod-validated API response schema.
            </li>
            <li>
              <strong className="text-amber-400">Minimal server error coverage.</strong> start.ts
              catches handler errors but only re-throws if statusCode is present; some failures may
              be masked.
            </li>
            <li>
              <strong className="text-amber-400">
                No input sanitization beyond length/maxLength.
              </strong>{" "}
              Names, company, email are only trimmed/lowercased; consider Zod for all public inputs.
            </li>
          </ul>
          <h3 className="mt-3 font-medium text-foreground">Maintainability</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>ESLint + Prettier are wired; run them in CI and pre-commit.</li>
            <li>
              Path alias{" "}
              <code className="text-amber-300 bg-amber-900/20 px-1 rounded text-xs">@/*</code> is
              good — keep using it consistently.
            </li>
            <li>Add a shared set of types for API/auth contracts and reuse across routes.</li>
            <li>
              Add Vitest for domain/auth logic early — auth is the riskiest logic to leave untested.
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold text-lg">3. Performance &amp; Scalability</h2>
          <h3 className="mt-3 font-medium text-foreground">What scales well today</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>Lightweight, static-ish shell with SSR entry</li>
            <li>TanStack Query wired with per-route QueryClient — ready for real API caching</li>
            <li>Small component tree; no heavy client state broadcasts</li>
            <li>Responsive, mobile-aware header</li>
          </ul>
          <h3 className="mt-3 font-medium text-foreground">Scalability concerns</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>All data is in-memory/localStorage — horizontal scaling is impossible as-is</li>
            <li>No caching strategy exists because there is no real API or DB</li>
            <li>No async processing, jobs, or background work</li>
            <li>No indexing concerns yet (no store), but design the schema for search up front</li>
          </ul>
          <h3 className="mt-3 font-medium text-foreground">Recommendations</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>
              Move persistence to a real DB. Start simple: SQLite/D1 for local dev, Postgres for
              multi-region.
            </li>
            <li>
              Add server-side caching for read-heavy views (e.g., availability catalog). Redis is a
              good fit once you have multi-instance deployment.
            </li>
            <li>
              Use TanStack Query staleTime/caching and mutations for the eventual API — the client
              is already ready.
            </li>
            <li>
              Introduce an async job mechanism for future background work (emails, booking
              pipelines, notifications).
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold text-lg">4. Security Assessment</h2>
          <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <h3 className="font-semibold text-red-400">High severity</h3>
            <ul className="mt-1.5 list-disc pl-5 text-red-200">
              <li>
                Credentials (hashes) stored client-side in localStorage. Any XSS can exfiltrate
                them; also enables offline brute forcing of weak hashes.
              </li>
              <li>
                Weak password hashing: salted SHA-256 with a static salt is not suitable for
                passwords.
              </li>
              <li>
                No server-side authentication or authorization. Roles can be manipulated in client
                state.
              </li>
              <li>
                No CSRF protection on mutations yet — TanStack Start includes a CSRF middleware
                stub, but no server functions exist to protect.
              </li>
            </ul>
          </div>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="font-semibold text-amber-400">Medium severity</h3>
              <ul className="mt-1.5 list-disc pl-5 text-amber-200">
                <li>No rate limiting or account lockout on login/registration/reset.</li>
                <li>
                  Duplicate-email check and login are client-side only; trivially bypassed if server
                  authority is added without mirroring rules.
                </li>
                <li>No input length enforcement beyond UI maxLength (server must enforce).</li>
                <li>
                  Error paths reveal whether an email exists (register/reset), enabling enumeration
                  if server is added without care.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="font-semibold text-amber-400">Low / hygiene</h3>
              <ul className="mt-1.5 list-disc pl-5 text-amber-200">
                <li>
                  Password confirmation mismatch is validated — good. Extend to a shared validation
                  rule.
                </li>
                <li>
                  Meta/heading hygiene is reasonable; consider a strict CSP once real
                  scripts/external assets are added.
                </li>
                <li>
                  No HTTPS enforcement concerns yet (static preview), but production must enforce
                  TLS.
                </li>
              </ul>
            </div>
          </div>
          <h3 className="mt-3 font-medium text-foreground">Immediate security actions</h3>
          <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
            <li>
              Move credential storage and password verification to the server; never return or
              persist password hashes to the client.
            </li>
            <li>Replace SHA-256 with a proper password hasher (Argon2id/bcrypt) on the server.</li>
            <li>
              Add real authentication (session cookies or token-based) with server-enforced
              authorization by role.
            </li>
            <li>
              Enforce input validation on the server with Zod; treat client validation as UX only.
            </li>
            <li>Add rate limiting and generic errors to avoid user enumeration.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="font-semibold text-red-400">High priority</h2>
          <ul className="mt-2 list-disc pl-5 text-red-200 space-y-1">
            <li>
              Introduce a real backend + database; stop storing users/credentials in localStorage.
            </li>
            <li>
              Move auth to the server; use proper password hashing (Argon2/bcrypt) with per-user
              salts.
            </li>
            <li>Implement server-side session/auth with role-based access control.</li>
            <li>Add server-side input validation (Zod) for register/login/reset.</li>
            <li>Remove passwordHash from client-exposed User type.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="font-semibold text-amber-400">Medium priority</h2>
          <ul className="mt-2 list-disc pl-5 text-amber-200 space-y-1">
            <li>Add rate limiting / lockout on auth endpoints.</li>
            <li>Generic error messages to prevent email enumeration.</li>
            <li>Add CSP and secure cookie settings in production.</li>
            <li>Extract domain logic from UI into a shared layer.</li>
            <li>Add Vitest tests for auth/domain logic.</li>
            <li>Define data models for containers, routes, bookings, payments, notifications.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <h2 className="font-semibold text-emerald-400">Low priority / nice-to-have</h2>
          <ul className="mt-2 list-disc pl-5 text-emerald-200 space-y-1">
            <li>Introduce Redis/app-level caching for read-heavy views.</li>
            <li>Background job queue for emails/notifications.</li>
            <li>Tighten server error coverage and structured logging.</li>
            <li>Audit unused UI primitives and remove dead code.</li>
            <li>Add i18n if multi-region is in scope.</li>
            <li>Consider automated accessibility scans as UI grows.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border/60 bg-card p-5">
        <h2 className="font-semibold text-lg">Suggested sequencing</h2>
        <ol className="mt-2 list-decimal pl-5 text-muted-foreground space-y-1">
          <li>Stand up backend + DB and migrate auth off localStorage.</li>
          <li>Lock down credential handling and roles server-side.</li>
          <li>Add validation, rate limiting, and generic auth errors.</li>
          <li>
            Build the first real domain feature (e.g., container/route catalog) on top of the new
            API.
          </li>
          <li>Wire remaining "coming soon" modules one at a time with tests.</li>
        </ol>
      </section>

      <section className="mt-6 rounded-xl border border-border/60 bg-card p-5">
        <h2 className="font-semibold text-lg">Overall verdict</h2>
        <p className="mt-2 text-muted-foreground">
          As a <strong className="text-foreground">UI shell and prototype</strong>, this is clean,
          typed, and well-structured. As a{" "}
          <strong className="text-foreground">production system</strong>, it is not yet ready:
          identity, persistence, and security all live on the client with weak cryptography and no
          server authority. The highest-leverage move is to add a real backend and migrate
          auth/persistence off localStorage, then progressively build out the platform modules with
          proper server-side enforcement.
        </p>
      </section>
    </article>
  );
}
