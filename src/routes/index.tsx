import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Boxes,
  ClipboardList,
  MessagesSquare,
  Network,
  Package,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS, useCurrentUser } from "@/lib/auth";
import logoUrl from "@/assets/transitroutehub-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transit Route Hub — Cargo Space Aggregation & Booking" },
      {
        name: "description",
        content:
          "Book residual cubic metres inside partially filled road, rail, sea and air containers for small consignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const MODULES = [
  {
    to: "/verification",
    label: "Provider Verification",
    description: "Company, tax and fleet checks that badge a provider as trusted.",
    icon: BadgeCheck,
  },
  {
    to: "/routes",
    label: "Container & Route Management",
    description: "Publish lanes and residual container volume; adjust price and availability.",
    icon: RouteIcon,
  },
  {
    to: "/aggregation",
    label: "Cargo Space Aggregation",
    description: "Network-wide pooled capacity rolled up by lane and transport mode.",
    icon: Network,
  },
  {
    to: "/catalog",
    label: "Cargo Search & Booking",
    description: "Filter by origin, destination, mode and volume, then book instantly.",
    icon: Search,
  },
  {
    to: "/bookings",
    label: "Booking Management",
    description: "Advance shipments, cancel with automatic capacity release, follow status.",
    icon: ClipboardList,
  },
  {
    to: "/loading",
    label: "3D Load Planner",
    description: "Auto-pack booked cargo into the container, then drag packages in 3D.",
    icon: Boxes,
  },
  {
    to: "/payments",
    label: "Payment & Escrow",
    description: "Fund escrow on booking, release on delivery, refund on cancellation.",
    icon: Wallet,
  },
  {
    to: "/messages",
    label: "Communication & Notifications",
    description: "Per-shipment threads plus a notification feed for account events.",
    icon: MessagesSquare,
  },
  {
    to: "/admin",
    label: "Admin Dashboard",
    description: "Platform metrics, verification review, user roles and the audit trail.",
    icon: ShieldAlert,
  },
  {
    to: "/reports",
    label: "Reports & AI Enhancements",
    description: "Booking, revenue and utilisation reporting with an insight engine.",
    icon: BarChart3,
  },
] as const;

function Home() {
  const user = useCurrentUser();

  return (
    <div>
      <section className="hero-surface relative overflow-hidden">
        <div className="grid-backdrop absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-foreground sm:py-28">
          <img
            src={logoUrl}
            alt="Transit Route Hub"
            width={80}
            height={80}
            className="block h-20 w-20 rounded-2xl object-cover ring-1 ring-foreground/15"
          />
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-white/40 px-3 py-1 text-xs font-medium uppercase tracking-widest backdrop-blur">
            <ShieldCheck className="size-3.5" /> Server-authoritative access
          </span>
          <h1 className="text-balance-tight mt-6 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            Cargo space aggregation &amp; booking for Transit Route Hub.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-foreground/70">
            Search available volume across road, rail, sea and air containers, book the space you
            need, hold funds in escrow and track the shipment — with role-based dashboards for
            traders, providers and administrators.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Go to dashboard" : "Create an account"} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-foreground/25 bg-white/40 backdrop-blur"
            >
              <Link to="/catalog">Browse cargo space</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="border-foreground/25 bg-white/40 backdrop-blur"
            >
              <Link to="/aggregation">Network capacity</Link>
            </Button>
          </div>
          {user ? (
            <p className="mt-8 text-sm text-foreground/70">
              Signed in as {user.name} · {ROLE_LABELS[user.role]}
            </p>
          ) : (
            <p className="mt-8 text-sm text-foreground/70">
              Demo accounts: trader@trh.demo · provider@trh.demo · admin@trh.demo — password{" "}
              <span className="font-mono">demo1234</span>
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="metal-panel rounded-2xl border border-border p-8 text-center">
          <h2 className="text-2xl font-bold">How it works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Providers verify their business, publish lanes and list residual cubic metres. Traders
            search that pooled capacity, book it, fund escrow, and release funds on delivery.
            Administrators review verification, monitor capacity and audit every privileged action.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>For traders</CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="size-4 text-primary" /> Search &amp; book
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Filter by lane, mode and volume, compare price per m³, book and fund escrow.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>For providers</CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="size-4 text-primary" /> List &amp; fulfil
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Get verified, publish lanes and container volume, accept bookings and get paid from
                escrow.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>For admins</CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="size-4 text-primary" /> Operate the platform
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Review verifications, adjust roles, monitor escrow and read the audit trail.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          <h2 className="text-2xl font-bold">Platform modules</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each module is a live page backed by server functions — no placeholder screens.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-secondary/60"
            >
              <div className="flex items-center gap-2">
                <module.icon className="size-4 text-primary" />
                <span className="font-medium">{module.label}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Open{" "}
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
