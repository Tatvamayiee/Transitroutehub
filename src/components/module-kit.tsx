import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ModuleHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <Icon className="size-5 text-primary" />
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5">
          {Icon ? <Icon className="size-3.5" /> : null}
          {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-primary/15 text-primary",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

export function LoadingRows({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

/** Sign-in wall for pages that need an authenticated caller. */
export function SignInGate({ what }: { what: string }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4 text-primary" /> Sign in required
        </CardTitle>
        <CardDescription>
          {what} is only available to authenticated accounts. All access checks run on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/auth">Create an account</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function RoleBadge({ role }: { role: "trader" | "provider" | "admin" }) {
  const tone: Tone = role === "admin" ? "danger" : role === "provider" ? "info" : "neutral";
  return (
    <Badge variant="secondary" className={cn("capitalize", TONE_CLASS[tone])}>
      {role}
    </Badge>
  );
}
