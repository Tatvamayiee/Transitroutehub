import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, BadgeCheck, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorNote,
  LoadingRows,
  ModuleHeader,
  SignInGate,
  StatCard,
  StatusPill,
  type Tone,
} from "@/components/module-kit";
import {
  adminOverview,
  listAudit,
  listUsers,
  listVerifications,
  reviewVerification,
  setUserRole,
  useServerData,
  type AdminUserView,
  type AuditEvent,
  type DashboardMetrics,
  type UserRole,
  type VerificationView,
} from "@/lib/api";
import { useCurrentUser, useToken } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { VERIFICATION_LABELS } from "@/domain/types";
import type { VerificationStatus } from "@/domain/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Transit Route Hub" },
      {
        name: "description",
        content:
          "Platform-wide metrics, provider verification review, user roles and the system audit trail.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminPage,
});

const STATUS_TONE: Record<VerificationStatus, Tone> = {
  unverified: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function AdminPage() {
  const user = useCurrentUser();
  const token = useToken();
  const isAdmin = user?.role === "admin";

  const overview = useServerData<DashboardMetrics>(
    `admin-overview:${token ?? ""}`,
    () => adminOverview(token ?? ""),
    Boolean(token) && isAdmin,
  );
  const queue = useServerData<VerificationView[]>(
    `admin-verifications:${token ?? ""}`,
    () => listVerifications(token ?? ""),
    Boolean(token) && isAdmin,
  );
  const people = useServerData<AdminUserView[]>(
    `admin-users:${token ?? ""}`,
    () => listUsers(token ?? ""),
    Boolean(token) && isAdmin,
  );
  const audit = useServerData<AuditEvent[]>(
    `admin-audit:${token ?? ""}`,
    () => listAudit(token ?? ""),
    Boolean(token) && isAdmin,
  );

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={ShieldAlert}
          title="Admin dashboard"
          description="Platform metrics, verification review, user roles and the audit trail."
        />
        <SignInGate what="The admin dashboard" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ModuleHeader icon={ShieldAlert} title="Admin dashboard" description="Restricted area." />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Administrators only</CardTitle>
            <CardDescription>
              Your account does not have the administrator role, so this view is blocked on the
              server. Ask an administrator if you need access.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/reports">Reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function reload() {
    overview.reload();
    queue.reload();
    people.reload();
    audit.reload();
  }

  const metrics = overview.data;
  const rows = queue.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={ShieldAlert}
        title="Admin dashboard"
        description="Live platform state: capacity, bookings, escrow and the verification backlog. All actions are recorded in the audit trail."
        actions={
          <>
            <StatusPill label="Administrator" tone="danger" />
            <Button size="sm" variant="outline" onClick={reload}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </>
        }
      />

      {overview.error ? (
        <div className="mt-6">
          <ErrorNote message={overview.error} />
        </div>
      ) : null}

      {overview.loading && !metrics ? (
        <LoadingRows label="Loading platform metrics…" />
      ) : metrics ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Accounts"
              value={String(metrics.users.total)}
              hint={`${metrics.users.traders} traders · ${metrics.users.providers} providers · ${metrics.users.admins} admins`}
              icon={Users}
            />
            <StatCard
              label="Active capacity"
              value={`${metrics.capacityM3.toFixed(1)} m³`}
              hint={`${metrics.utilisationPct.toFixed(1)}% utilised · ${metrics.availableM3.toFixed(1)} m³ free`}
            />
            <StatCard
              label="Bookings"
              value={String(metrics.bookings.total)}
              hint={`${metrics.bookings.byStatus.in_transit} in transit · ${metrics.bookings.byStatus.delivered} delivered`}
            />
            <StatCard
              label="Escrow held"
              value={formatMoney(metrics.escrowHeld)}
              hint={`${formatMoney(metrics.released)} released · ${formatMoney(
                metrics.refunded,
              )} refunded`}
              icon={Activity}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Lanes" value={String(metrics.lanes)} />
            <StatCard label="Containers" value={String(metrics.containers)} />
            <StatCard
              label="Pending verifications"
              value={String(metrics.pendingVerifications)}
              icon={BadgeCheck}
            />
          </div>
        </>
      ) : null}

      <Tabs defaultValue="queue" className="mt-8">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-3">
          <TabsTrigger value="queue">Verification queue</TabsTrigger>
          <TabsTrigger value="users">Users &amp; roles</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider verification review</CardTitle>
              <CardDescription>
                Approving a provider badges every lane they operate. Rejections require a reason the
                provider can act on.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queue.error ? <ErrorNote message={queue.error} /> : null}
              {queue.loading && !queue.data ? (
                <LoadingRows label="Loading submissions…" />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Nothing to review"
                  description="Submissions from providers will appear here."
                />
              ) : (
                <div className="grid gap-3">
                  {rows.map((row) => (
                    <ReviewCard
                      key={row.verification.id}
                      row={row}
                      token={token}
                      onReviewed={reload}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accounts</CardTitle>
              <CardDescription>
                Change a role to grant or revoke access. You cannot change your own role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {people.error ? <ErrorNote message={people.error} /> : null}
              {people.loading && !people.data ? (
                <LoadingRows label="Loading accounts…" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Lanes</TableHead>
                      <TableHead className="text-right">Containers</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead>Verification</TableHead>
                      <TableHead className="w-40">Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(people.data ?? []).map((row) => (
                      <UserRowAdmin
                        key={row.user.id}
                        row={row}
                        token={token}
                        isSelf={row.user.id === user.id}
                        onChanged={reload}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trail</CardTitle>
              <CardDescription>Every privileged mutation, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {audit.error ? <ErrorNote message={audit.error} /> : null}
              {audit.loading && !audit.data ? (
                <LoadingRows label="Loading audit events…" />
              ) : (audit.data ?? []).length === 0 ? (
                <EmptyState title="No events recorded yet" />
              ) : (
                <ul className="grid gap-1.5">
                  {(audit.data ?? []).map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{event.actorName}</span>{" "}
                        <span className="text-muted-foreground">{event.action}</span>{" "}
                        <span className="font-mono text-xs">{event.target}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewCard({
  row,
  token,
  onReviewed,
}: {
  row: VerificationView;
  token: string;
  onReviewed: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    const result = await reviewVerification({
      token,
      providerId: row.verification.providerId,
      decision,
      note,
    });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      decision === "approved"
        ? `${row.verification.legalName} is now a verified provider.`
        : `${row.verification.legalName} was rejected.`,
    );
    setNote("");
    onReviewed();
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{row.verification.legalName}</div>
          <div className="text-xs text-muted-foreground">
            {row.providerName} · {row.providerCompany} · {row.providerEmail}
          </div>
        </div>
        <StatusPill
          label={VERIFICATION_LABELS[row.verification.status]}
          tone={STATUS_TONE[row.verification.status]}
        />
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Registration</dt>
          <dd className="font-mono text-xs">{row.verification.registrationNo}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tax ID</dt>
          <dd className="font-mono text-xs">{row.verification.taxId}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contact</dt>
          <dd className="text-xs">
            {row.verification.contactEmail} · {row.verification.contactPhone}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Fleet</dt>
          <dd className="text-xs">{row.verification.fleetSize} vehicle(s)</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Documents</dt>
          <dd className="text-xs">{row.verification.documentRefs || "None supplied"}</dd>
        </div>
      </dl>

      {row.verification.reviewNote ? (
        <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs">
          Previous note: {row.verification.reviewNote}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-sm"
          placeholder="Reviewer note (required when rejecting)"
          aria-label={`Reviewer note for ${row.verification.legalName}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          size="sm"
          disabled={busy !== null || row.verification.status === "approved"}
          onClick={() => decide("approved")}
        >
          {busy === "approved" ? "Approving…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null || row.verification.status === "rejected"}
          onClick={() => {
            if (!note.trim()) {
              toast.error("Add a note explaining the rejection.");
              return;
            }
            void decide("rejected");
          }}
        >
          {busy === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

function UserRowAdmin({
  row,
  token,
  isSelf,
  onChanged,
}: {
  row: AdminUserView;
  token: string;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [role, setRole] = useState<UserRole>(row.user.role);
  const [busy, setBusy] = useState(false);

  async function save(next: UserRole) {
    setRole(next);
    setBusy(true);
    const result = await setUserRole(token, row.user.id, next);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      setRole(row.user.role);
      return;
    }
    toast.success(`${row.user.name} is now a ${next}.`);
    onChanged();
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.user.name}</div>
        <div className="text-xs text-muted-foreground">{row.user.email}</div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{row.user.company || "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{row.laneCount}</TableCell>
      <TableCell className="text-right tabular-nums">{row.containerCount}</TableCell>
      <TableCell className="text-right tabular-nums">{row.bookingCount}</TableCell>
      <TableCell>
        <StatusPill
          label={VERIFICATION_LABELS[row.verificationStatus]}
          tone={STATUS_TONE[row.verificationStatus]}
        />
      </TableCell>
      <TableCell>
        <Select
          value={role}
          onValueChange={(value) => void save(value as UserRole)}
          disabled={isSelf || busy}
        >
          <SelectTrigger aria-label={`Role for ${row.user.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trader">Trader</SelectItem>
            <SelectItem value="provider">Provider</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        {isSelf ? <p className="mt-1 text-xs text-muted-foreground">Your own account</p> : null}
      </TableCell>
    </TableRow>
  );
}
