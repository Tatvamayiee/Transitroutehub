import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_NAV, StatusPill } from "@/components/module-kit";
import { logout, ROLE_LABELS, ROLE_PERMISSIONS, useCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "User Dashboard — Transit Route Hub" },
      {
        name: "description",
        content:
          "Role-based dashboard showing your Transit Route Hub account details, permissions and module shortcuts.",
      },
      { property: "og:title", content: "User Dashboard — Transit Route Hub" },
      {
        property: "og:description",
        content: "Your account, role permissions and quick actions on Transit Route Hub.",
      },
    ],
  }),
  component: DashboardPage,
});

const MODULE_ACCESS: Record<string, readonly UserRole[]> = {
  "/verification": ["provider", "admin"],
  "/routes": ["provider", "admin"],
  "/aggregation": ["trader", "provider", "admin"],
  "/catalog": ["trader", "provider", "admin"],
  "/bookings": ["trader", "provider", "admin"],
  "/loading": ["trader", "provider", "admin"],
  "/payments": ["trader", "provider", "admin"],
  "/messages": ["trader", "provider", "admin"],
  "/admin": ["admin"],
  "/reports": ["provider", "admin"],
};

function DashboardPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  // The session is rehydrated from localStorage after the first client render, so a
  // hard reload briefly sees `user === null`. Wait for that hydration before bouncing
  // a signed-in visitor to the sign-in page.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/auth", replace: true });
  }, [hydrated, user, navigate]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  const permissions = ROLE_PERMISSIONS[user.role] ?? [];
  const modules = MODULE_NAV.filter((module) =>
    (MODULE_ACCESS[module.to] ?? []).includes(user.role),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.email}
            {user.company ? ` · ${user.company}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account ID</CardDescription>
            <CardTitle className="font-mono text-sm">{user.id}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Role</CardDescription>
            <CardTitle className="text-lg">{ROLE_LABELS[user.role]}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Member since</CardDescription>
            <CardTitle className="text-lg">
              {new Date(user.createdAt).toLocaleDateString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your modules</CardTitle>
          <CardDescription>
            Unlocked for the {ROLE_LABELS[user.role].toLowerCase()} role. Every check is repeated on
            the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className="group flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-secondary"
            >
              <span className="font-medium">{module.label}</span>
              <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> Role permissions
          </CardTitle>
          <CardDescription>What this account is allowed to do.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {permissions.map((permission) => (
            <div key={permission} className="rounded-md border border-border px-3 py-2">
              {permission}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
