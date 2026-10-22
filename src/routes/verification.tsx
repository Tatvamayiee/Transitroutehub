import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, FileCheck2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  getMyVerification,
  listVerifications,
  submitVerification,
  useServerData,
  type ProviderVerification,
  type VerificationView,
} from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { VERIFICATION_LABELS } from "@/domain/types";
import type { VerificationStatus } from "@/domain/types";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Provider Verification — Transit Route Hub" },
      {
        name: "description",
        content:
          "Submit company registration, tax and contact details so administrators can verify your logistics business.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: VerificationPage,
});

const STATUS_TONE: Record<VerificationStatus, Tone> = {
  unverified: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function VerificationPage() {
  const user = useCurrentUser();
  const token = useToken();
  const isAdmin = user?.role === "admin";

  const mine = useServerData<ProviderVerification | null>(
    `verification:${token ?? ""}`,
    () => getMyVerification(token ?? ""),
    Boolean(token) && !isAdmin,
  );
  const queue = useServerData<VerificationView[]>(
    `verification-queue:${token ?? ""}`,
    () => listVerifications(token ?? ""),
    Boolean(token) && isAdmin,
  );

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ModuleHeader
          icon={BadgeCheck}
          title="Provider verification"
          description="Verified providers are badged in search results, which measurably improves booking conversion."
        />
        <SignInGate what="Provider verification" />
      </div>
    );
  }

  if (user.role === "trader") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ModuleHeader
          icon={BadgeCheck}
          title="Provider verification"
          description="Verification applies to logistics providers who list capacity."
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Not applicable to trader accounts</CardTitle>
            <CardDescription>
              You are signed in as {ROLE_LABELS[user.role]}. Providers submit verification so
              traders can trust the capacity they list.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link to="/catalog">Search verified capacity</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/bookings">My bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const record = isAdmin ? null : (mine.data ?? null);
  const status: VerificationStatus = record?.status ?? "unverified";
  const rows = queue.data ?? [];
  const pending = rows.filter((row) => row.verification.status === "pending").length;
  const approved = rows.filter((row) => row.verification.status === "approved").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <ModuleHeader
        icon={BadgeCheck}
        title="Provider verification"
        description={
          isAdmin
            ? "The review queue for provider submissions. Approving a provider badges every lane they operate."
            : "Submit your company registration and contact details. Administrators review submissions and badge approved providers in search."
        }
        actions={
          <>
            <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                mine.reload();
                queue.reload();
              }}
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
            {isAdmin ? (
              <Button asChild size="sm">
                <Link to="/admin">Review in admin</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {isAdmin ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Submissions" value={String(rows.length)} icon={FileCheck2} />
            <StatCard label="Pending review" value={String(pending)} />
            <StatCard label="Approved providers" value={String(approved)} icon={BadgeCheck} />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Review queue</CardTitle>
              <CardDescription>
                Approve or reject submissions from the admin dashboard, where the full company
                record is shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queue.error ? <ErrorNote message={queue.error} /> : null}
              {queue.loading && !queue.data ? (
                <LoadingRows label="Loading submissions…" />
              ) : rows.length === 0 ? (
                <EmptyState title="No submissions yet" />
              ) : (
                <ul className="grid gap-2">
                  {rows.map((row) => (
                    <li
                      key={row.verification.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium">{row.verification.legalName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.providerName} · {row.laneCount} lane(s) · {row.containerCount}{" "}
                          container(s)
                        </div>
                      </div>
                      <StatusPill
                        label={VERIFICATION_LABELS[row.verification.status]}
                        tone={STATUS_TONE[row.verification.status]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {status === "unverified" ? "Submit verification" : "Verification details"}
              </CardTitle>
              <CardDescription>
                All fields are validated on the server. Resubmitting replaces your previous
                submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mine.error ? <ErrorNote message={mine.error} /> : null}
              {mine.loading && !mine.data && status === "unverified" ? (
                <LoadingRows label="Checking your verification status…" />
              ) : (
                <VerificationForm token={token} record={record} onSaved={mine.reload} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
              <CardDescription>What traders see next to your lanes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current state</span>
                <StatusPill label={VERIFICATION_LABELS[status]} tone={STATUS_TONE[status]} />
              </div>
              {record?.submittedAt ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Submitted</span>
                  <span>{new Date(record.submittedAt).toLocaleDateString()}</span>
                </div>
              ) : null}
              {record?.reviewedAt ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Reviewed</span>
                  <span>{new Date(record.reviewedAt).toLocaleDateString()}</span>
                </div>
              ) : null}
              {record?.reviewNote ? (
                <div className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Reviewer note
                  </div>
                  <p className="mt-1">{record.reviewNote}</p>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Approved providers get a shield badge in search results. Until then, buyers see your
                listings as unverified.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function VerificationForm({
  token,
  record,
  onSaved,
}: {
  token: string;
  record: ProviderVerification | null;
  onSaved: () => void;
}) {
  const [legalName, setLegalName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [fleetSize, setFleetSize] = useState("1");
  const [documentRefs, setDocumentRefs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!record) return;
    setLegalName(record.legalName);
    setRegistrationNo(record.registrationNo);
    setTaxId(record.taxId);
    setContactEmail(record.contactEmail);
    setContactPhone(record.contactPhone);
    setFleetSize(String(record.fleetSize));
    setDocumentRefs(record.documentRefs);
  }, [record]);

  const locked = record?.status === "pending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await submitVerification({
      token,
      legalName,
      registrationNo,
      taxId,
      contactEmail,
      contactPhone,
      fleetSize: Number(fleetSize) || 0,
      documentRefs,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Verification submitted for review.");
    onSaved();
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="v-legal">Registered legal name</Label>
        <Input
          id="v-legal"
          required
          disabled={locked}
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="v-reg">Registration number</Label>
        <Input
          id="v-reg"
          required
          disabled={locked}
          value={registrationNo}
          onChange={(e) => setRegistrationNo(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="v-tax">Tax identifier</Label>
        <Input
          id="v-tax"
          required
          disabled={locked}
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="v-email">Operations email</Label>
        <Input
          id="v-email"
          type="email"
          required
          disabled={locked}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="v-phone">Contact phone</Label>
        <Input
          id="v-phone"
          required
          disabled={locked}
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="v-fleet">Fleet size</Label>
        <Input
          id="v-fleet"
          type="number"
          min="0"
          disabled={locked}
          value={fleetSize}
          onChange={(e) => setFleetSize(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="v-docs">Document references</Label>
        <Input
          id="v-docs"
          disabled={locked}
          placeholder="chamber-of-commerce.pdf, insurance.pdf"
          value={documentRefs}
          onChange={(e) => setDocumentRefs(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy || locked}>
          {locked ? "Awaiting review" : busy ? "Submitting…" : "Submit for review"}
        </Button>
        {locked ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Your submission is in the review queue and can no longer be edited.
          </p>
        ) : null}
      </div>
    </form>
  );
}
