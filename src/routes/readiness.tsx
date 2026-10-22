import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  Calculator,
  Shield,
  Zap,
  Database,
  Code,
  Layers,
  RotateCcw,
} from "lucide-react";
import { ReadinessRadar } from "@/components/ReadinessRadar";

const PILLARS = [
  {
    name: "Architecture",
    color: "#6366f1",
    score: 1.6,
    weight: 20,
    items: [
      { label: "Real backend + DB", value: 1, note: "localStorage-only today" },
      { label: "Server authority / isolation", value: 1, note: "no server functions wired" },
      { label: "Async / background processing", value: 1, note: "no queue or jobs" },
    ],
  },
  {
    name: "AI & Agentic",
    color: "#f59e0b",
    score: 0.6,
    weight: 10,
    items: [
      { label: "LLM integration", value: 0, note: "no AI module yet" },
      { label: "Structured output / schema", value: 1, note: "Zod available, unused for AI" },
      { label: "Checkpointing / fallback", value: 0, note: "no agentic workflows" },
    ],
  },
  {
    name: "Data & Caching",
    color: "#10b981",
    score: 1.0,
    weight: 15,
    items: [
      { label: "Persistent database", value: 1, note: "D1/Postgres not wired" },
      { label: "Indexing strategy", value: 1, note: "design exists, no store" },
      { label: "Caching layer (Redis etc.)", value: 0, note: "no cache today" },
    ],
  },
  {
    name: "Performance & DevOps",
    color: "#3b82f6",
    score: 1.8,
    weight: 15,
    items: [
      { label: "CI gate (lint/type/test)", value: 2, note: "linters wired, tests missing" },
      { label: "Preview + prod deploy", value: 2, note: "Workers build works" },
      { label: "Observability / tracing", value: 1, note: "frontend error capture exists" },
    ],
  },
  {
    name: "Security",
    color: "#ef4444",
    score: 0.8,
    weight: 25,
    items: [
      { label: "Server-side auth", value: 0, note: "client-only today" },
      { label: "Password hashing (Argon2/bcrypt)", value: 0, note: "SHA-256 static salt" },
      { label: "Validation + rate limiting", value: 1, note: "client-only, no server" },
      { label: "CSRF / CSP / TLS", value: 1, note: "CSRF stub, not active" },
      { label: "No credential leakage", value: 0, note: "hash in localStorage" },
    ],
  },
  {
    name: "Code Hygiene",
    color: "#8b5cf6",
    score: 2.4,
    weight: 15,
    items: [
      { label: "Strict TypeScript flags", value: 4, note: "already strong" },
      { label: "Domain / service layer", value: 1, note: "logic in client lib" },
      { label: "Tests (Vitest)", value: 1, note: "none yet" },
      { label: "Clean interfaces (result types)", value: 1, note: "ad-hoc result shapes" },
    ],
  },
];

function pillarScore(items: { value: number }[]) {
  if (!items.length) return 0;
  return items.reduce((s, i) => s + i.value, 0) / items.length;
}

const ROADMAP = [
  {
    id: "r1",
    pillar: "Security",
    title: "Add TanStack Start server functions + real DB (D1/SQLite)",
    effort: "2 weeks",
    impact: 10,
    ready: "immediate",
  },
  {
    id: "r2",
    pillar: "Security",
    title: "Move auth fully server-side; Argon2/bcrypt with per-user salts",
    effort: "1 week",
    impact: 10,
    ready: "after r1",
  },
  {
    id: "r3",
    pillar: "Security",
    title: "Server-enforced sessions and role-based authorization",
    effort: "1 week",
    impact: 9,
    ready: "after r2",
  },
  {
    id: "r4",
    pillar: "Security",
    title: "Zod schemas for register/login/reset; server enforcement",
    effort: "half week",
    impact: 7,
    ready: "immediate",
  },
  {
    id: "r5",
    pillar: "Security",
    title: "Remove passwordHash from client-exposed User type",
    effort: "hours",
    impact: 8,
    ready: "immediate",
  },
  {
    id: "r6",
    pillar: "Security",
    title: "Rate limiting + generic errors (no user enumeration)",
    effort: "half week",
    impact: 6,
    ready: "after r1",
  },
  {
    id: "r7",
    pillar: "Architecture",
    title: "Extract shared domain layer (entities, validation, permissions)",
    effort: "half week",
    impact: 7,
    ready: "immediate",
  },
  {
    id: "r8",
    pillar: "Architecture",
    title: "Thin server-function handlers: validate → service → return",
    effort: "half week",
    impact: 6,
    ready: "after r1",
  },
  {
    id: "r9",
    pillar: "Data & Caching",
    title: "Data models + indexes for containers/routes/bookings/payments",
    effort: "half week",
    impact: 7,
    ready: "after r1",
  },
  {
    id: "r10",
    pillar: "Data & Caching",
    title: "Redis/app cache for read-heavy catalog; invalidate on mutations",
    effort: "1 week",
    impact: 6,
    ready: "after catalog",
  },
  {
    id: "r11",
    pillar: "Data & Caching",
    title: "Async job queue for emails / notifications / booking pipelines",
    effort: "1 week",
    impact: 6,
    ready: "after r1",
  },
  {
    id: "r12",
    pillar: "Code Hygiene",
    title: "Add Vitest for auth/domain logic",
    effort: "half week",
    impact: 7,
    ready: "immediate",
  },
  {
    id: "r13",
    pillar: "Code Hygiene",
    title: "Discriminated result types (Success/Failure) instead of ad-hoc shapes",
    effort: "half week",
    impact: 5,
    ready: "immediate",
  },
  {
    id: "r14",
    pillar: "Performance & DevOps",
    title: "CI: lint + typecheck + test gate before deploy",
    effort: "half week",
    impact: 6,
    ready: "immediate",
  },
  {
    id: "r15",
    pillar: "Performance & DevOps",
    title: "Structured server logging with request IDs + error pipeline",
    effort: "half week",
    impact: 5,
    ready: "after r1",
  },
  {
    id: "r16",
    pillar: "AI & Agentic",
    title: "Design AI module contract: orchestrator, checkpointing, structured output, timeouts",
    effort: "half week",
    impact: 4,
    ready: "after r1",
  },
  {
    id: "r17",
    pillar: "AI & Agentic",
    title: "Implement first agentic flow with fallback handlers",
    effort: "1 week",
    impact: 5,
    ready: "after r16",
  },
];

const IMPLEMENTATION_PLAN_DETAIL = {
  Security: {
    summary:
      "The biggest gap. Identity, persistence, and credential handling all live on the client with weak crypto and no server authority.",
    steps: [
      "Stand up TanStack Start server functions behind a real database (start with D1/SQLite for portable local dev).",
      "Move register/login/reset to the server; hash with Argon2id (or bcrypt) with per-user salts. Never return a password hash to the client.",
      "Issue server-enforced sessions (signed cookies or tokens). Check role server-side on every protected call; the client only renders UI.",
      "Scope data access by user id server-side (traders see their bookings, providers manage their containers).",
      "Add Zod schemas for public inputs and reuse them client-side (UX) and server-side (enforcement).",
      "Remove passwordHash from any client-exposed type and from localStorage.",
      "Add rate limiting and generic error messages to avoid user enumeration.",
    ],
  },
  Architecture: {
    summary:
      "The frontend is coherent; the gap is the lack of a server boundary and a domain layer.",
    steps: [
      "Introduce server functions as the RPC boundary for all mutations and private reads.",
      "Extract a pure domain module (entities, validation rules, permission logic) that both client and server import.",
      "Keep client state as a thin view model that talks to server functions, not the source of truth.",
      "Split the 'coming soon' header pills into real feature slices with routes, server functions, and data models as they are built.",
      "Make handlers thin: validate → call service → return. No business logic in the handler.",
    ],
  },
  "Data & Caching": {
    summary:
      "No store today. Design a portable schema and add caching only after the read patterns are real.",
    steps: [
      "Define tables: users, containers, routes, bookings, payments (see the prior review).",
      "Add indexes: users.email (unique), containers(provider_id, status), containers(route_id, status), bookings(user_id, status), bookings(container_id), routes(origin, destination, scheduled_at).",
      "Start with one D1 (SQLite) database; migrate to Postgres later if multi-region writes or richer querying are needed.",
      "Add Redis (or in-process cache early) for read-heavy catalog queries; invalidate on mutations.",
      "Use TanStack Query staleTime/caching for catalog/availability data that changes infrequently.",
      "Introduce a queue for any background work rather than blocking HTTP requests.",
    ],
  },
  "Performance & DevOps": {
    summary:
      "The shell is light; the levers are what you put behind the routes and how you ship it.",
    steps: [
      "Keep server functions focused and indexed; cache read-heavy catalog data.",
      "Run lint + typecheck + Prettier in CI and on pre-commit (already wired, needs the gate).",
      "Add Vitest and, later, lightweight integration tests against a real local D1.",
      "Preview deploy every PR; production deploy after manual smoke (health, auth, one catalog query).",
      "Add a health endpoint and a small error pipeline for server-side failures with request IDs.",
    ],
  },
  "AI & Agentic": {
    summary:
      "No AI today. Design the contract before wiring any model so the module is testable and bounded.",
    steps: [
      "Define an orchestrator server function / route handler that runs a state machine over steps.",
      "Require structured output (Zod schema or provider structured-output mode) for every LLM step.",
      "Persist workflow state (status, step, intermediate results, failure reason) after each step; support resume.",
      "Set per-step timeouts and a total budget (tokens + time); fail fast with a graceful degradation path.",
      "Prefer deterministic logic for the parts that don't need LLM reasoning; use the model only for the open-ended step.",
      "Add fallback handlers: low-confidence or failed LLM output falls back to a rule-based path or a clear error, never a raw exception.",
    ],
  },
  "Code Hygiene": {
    summary:
      "Already strong on TypeScript discipline; the next moves are layering, tests, and stable interfaces.",
    steps: [
      "Adopt a repository/query abstraction over DB calls so use cases don't inline SQL and the store can be swapped.",
      "Pass DB client, cache, and queue into services explicitly rather than using globals.",
      "Use discriminated result types (Success<T> / Failure with stable codes) for services and server functions.",
      "Add Vitest for domain and service logic early; auth and permissions are the riskiest to leave untested.",
      "Periodically audit unused UI primitives as features land.",
    ],
  },
};

function RoadmapRow({ item, highlighted }: { item: (typeof ROADMAP)[0]; highlighted: boolean }) {
  return (
    <div
      className={`grid gap-2 rounded-xl border p-3 transition-colors ${
        highlighted ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 text-[10px] font-semibold uppercase">
          {item.ready === "immediate" ? "Now" : item.ready === "after r1" ? "r1+" : "later"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{item.title}</span>
            <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
              {item.impact}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Pillar: {item.pillar}</span>
            <span>Effort: {item.effort}</span>
            <span>Depends: {item.ready}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillarPanel({ pillar, onSelect }: { pillar: (typeof PILLARS)[0]; onSelect: () => void }) {
  const avg = pillarScore(pillar.items);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: pillar.color }} />
            <h3 className="font-semibold">{pillar.name}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Weight {pillar.weight}% · average {avg.toFixed(1)} / 5
          </p>
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color: pillar.color }}>
          {pillar.score.toFixed(1)}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {pillar.items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/60 text-[9px] font-semibold">
              {item.value}
            </span>
            <div>
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="ml-2 text-muted-foreground">{item.note}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Layers className="size-3.5" /> Detail & implementation plan
        </button>
      </div>
    </div>
  );
}

function DetailDrawer({ pillarName, onClose }: { pillarName: string | null; onClose: () => void }) {
  if (!pillarName) return null;
  const plans: Record<string, { summary: string; steps: string[] } | undefined> =
    IMPLEMENTATION_PLAN_DETAIL;
  const data = plans[pillarName];
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="flex h-full w-full items-end" onClick={onClose}>
        <div className="flex h-full w-full" onClick={() => {}}>
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" aria-hidden />
        </div>
        <div className="relative mb-6 w-full max-w-lg rounded-t-2xl bg-card border-t border-border/60 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">{pillarName} — Implementation plan</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border/60 p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <RotateCcw className="size-4 rotate-45" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4 text-sm">
            <p className="text-muted-foreground">{data.summary}</p>
            <ol className="mt-4 list-decimal pl-5 space-y-2 text-foreground">
              {data.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Production Readiness Scorecard — Transit Route Hub" },
      {
        name: "description",
        content:
          "Interactive 6-pillar readiness scorecard with radar, sub-scores, and ranked roadmap.",
      },
    ],
  }),
  component: ReadinessPage,
});

function ReadinessPage() {
  const navigate = useNavigate();
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [sort, setSort] = useState<"impact" | "ready" | "effort">("impact");
  const [filter, setFilter] = useState<string>("all");

  const sorted = [...ROADMAP]
    .filter((r) => filter === "all" || r.pillar === filter)
    .sort((a, b) => {
      if (sort === "impact") return b.impact - a.impact;
      if (sort === "ready") {
        const rank = (r: (typeof ROADMAP)[0]) =>
          r.ready === "immediate" ? 0 : r.ready === "after r1" ? 1 : 2;
        return rank(a) - rank(b) || b.impact - a.impact;
      }
      const effRank = (r: (typeof ROADMAP)[0]) =>
        r.effort.includes("hours") ? 0 : r.effort.includes("half") ? 1 : 2;
      return effRank(a) - effRank(b) || b.impact - a.impact;
    });

  const totalWeight = PILLARS.reduce((s, p) => s + p.weight, 0);
  const weightedScore = PILLARS.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0);

  return (
    <article className="mx-auto max-w-5xl px-4 py-10 text-sm">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Production Readiness Scorecard
          </h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Transit Route Hub · live 6-pillar assessment with ranked implementation roadmap
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">Weighted readiness</span>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-400">
              {weightedScore.toFixed(2)} / 5
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">Pillars scored</span>
            <div className="mt-1 text-2xl font-bold tabular-nums">{PILLARS.length}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">Tracked tasks</span>
            <div className="mt-1 text-2xl font-bold tabular-nums">{ROADMAP.length}</div>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Radar — current posture</h2>
          <span className="text-xs text-muted-foreground">Higher polygon = stronger pillar</span>
        </div>
        <ReadinessRadar pillars={PILLARS} />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 font-semibold">Pillar breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <PillarPanel key={p.name} pillar={p} onSelect={() => setSelectedPillar(p.name)} />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-4 font-semibold">Ranked implementation roadmap</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="bg-transparent text-foreground outline-none"
            >
              <option value="impact">Impact</option>
              <option value="ready">Dependency order</option>
              <option value="effort">Effort (low first)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-foreground outline-none"
            >
              <option value="all">All pillars</option>
              {PILLARS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="space-y-3">
          {sorted.map((item) => (
            <RoadmapRow key={item.id} item={item} highlighted={selectedPillar === item.pillar} />
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Scoring methodology</h2>
        </div>
        <p className="mt-2 text-muted-foreground">
          Each pillar is scored 0–5 from its sub-items (equal weight within the pillar), then
          combined into a weighted overall score using pillar weights: Security 25%, Architecture
          20%, Data & Caching 15%, Performance & DevOps 15%, Code Hygiene 15%, AI & Agentic 10%.
          Sub-item scores reflect current implementation depth: 0 = absent, 1 = placeholder/design
          only, 2 = partial, 3 = usable, 4 = strong, 5 = best practice.
        </p>
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Evidence & assumptions</h2>
        </div>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-1">
          <li>
            Built from a full audit of this codebase (routes, server entry, auth lib, error
            handling, UI surface).
          </li>
          <li>
            Auth, persistence, and credential handling are client-side today — reflected as low
            scores.
          </li>
          <li>
            No AI module exists yet; AI pillar assumes a future "Reports & AI Enhancements" module.
          </li>
          <li>Dev server and build are healthy; lint/typecheck are wired; tests are absent.</li>
          <li>
            Weights and scores are a planning starting point — adjust as you validate costs with
            your team.
          </li>
        </ul>
      </section>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => navigate({ to: "/review" })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Code className="size-3.5" /> Full written review
        </button>
      </div>

      <DetailDrawer pillarName={selectedPillar} onClose={() => setSelectedPillar(null)} />
    </article>
  );
}
