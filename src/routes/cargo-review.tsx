import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorNote,
  LoadingRows,
  ModuleHeader,
  SignInGate,
  StatCard,
} from "@/components/module-kit";
import { CargoPhotoDialog, CargoPhotoPill } from "@/components/cargo-photo";
import { cargoReviewQueue, useServerData, type BookingView } from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { MODE_LABELS } from "@/domain/types";

export const Route = createFileRoute("/cargo-review")({
  head: () => ({
    meta: [
      { title: "Cargo Photo Review — Transit Route Hub" },
      {
        name: "description",
        content:
          "Providers review cargo photographs on their own bookings; rejections carry a note the trader can act on.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CargoReviewPage,
});

function CargoReviewPage() {
  const user = useCurrentUser();
  const token = useToken();
  const allowed = user?.role === "provider" || user?.role === "admin";
  const queue = useServerData<BookingView[]>(
    `cargo-review:${token ?? ""}`,
    () => cargoReviewQueue(token ?? ""),
    Boolean(token) && allowed,
  );
  const [active, setActive] = useState<BookingView | null>(null);
  const [tab, setTab] = useState("pending");

  const rows = useMemo(() => queue.data ?? [], [queue.data]);
  const counts = useMemo(() => {
    const pending = rows.filter((row) => row.booking.reviewStatus === "pending").length;
    const approved = rows.filter((row) => row.booking.reviewStatus === "approved").length;
    const rejected = rows.filter((row) => row.booking.reviewStatus === "rejected").length;
    return { pending, approved, rejected };
  }, [rows]);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={Camera}
          title="Cargo photo review"
          description="Providers approve or reject the cargo photographs traders attach to their bookings."
        />
        <SignInGate what="Cargo photo review" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={Camera}
          title="Cargo photo review"
          description="Providers approve or reject the cargo photographs traders attach to their bookings."
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-primary" /> Providers only
            </CardTitle>
            <CardDescription>
              You are signed in as {ROLE_LABELS[user.role]}. The review queue is limited to
              logistics providers and administrators, and the check is repeated on the server. Your
              own uploads live under Booking Management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  function refresh() {
    queue.reload();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={Camera}
        title="Cargo photo review"
        description="Photographs submitted by traders on your bookings. Only bookings on your own capacity appear here; approval never changes a booking status."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <CargoPhotoStatusLegend />
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting review" value={String(counts.pending)} icon={Clock} />
        <StatCard label="Approved" value={String(counts.approved)} icon={CheckCircle2} />
        <StatCard label="Rejected" value={String(counts.rejected)} icon={XCircle} />
      </div>

      {queue.error ? (
        <div className="mt-6">
          <ErrorNote message={queue.error} />
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="pending">Awaiting review ({counts.pending})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <PhotoGrid
            rows={rows.filter((row) => row.booking.reviewStatus === "pending")}
            loading={queue.loading && !queue.data}
            onOpen={setActive}
            emptyTitle="Nothing to review"
            emptyDescription="When a trader uploads a cargo photograph on one of your bookings it lands here."
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PhotoGrid
            rows={rows.filter((row) => row.booking.reviewStatus !== "pending")}
            loading={queue.loading && !queue.data}
            onOpen={setActive}
            emptyTitle="No decisions yet"
            emptyDescription="Approved and rejected photographs are kept here for your audit trail."
          />
        </TabsContent>
      </Tabs>

      {active ? (
        <CargoPhotoDialog
          view={active}
          token={token ?? ""}
          open={active !== null}
          onOpenChange={(open) => {
            if (!open) setActive(null);
          }}
          canUpload={false}
          canReview
          onChanged={(status) => {
            setActive(null);
            // Follow the record: a pending photo belongs in the queue, a decided
            // one in history — reopening an approval moves it back.
            setTab(status === "pending" ? "pending" : "history");
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CargoPhotoStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CargoPhotoPill status="pending" />
      <CargoPhotoPill status="approved" />
      <CargoPhotoPill status="rejected" />
    </div>
  );
}

function PhotoGrid({
  rows,
  loading,
  onOpen,
  emptyTitle,
  emptyDescription,
}: {
  rows: BookingView[];
  loading: boolean;
  onOpen: (view: BookingView) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingRows label="Loading cargo photos…" />
        </CardContent>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((row) => {
        const { booking, lane, container, traderName, amount } = row;
        return (
          <Card key={booking.id} className="overflow-hidden">
            <div className="border-b border-border/60 bg-muted/40">
              {row.cargoPhotoUrl ? (
                <img
                  src={row.cargoPhotoUrl}
                  alt={booking.cargoPhotoLabel ?? "Cargo photograph"}
                  className="h-44 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
                  Preview unavailable — open the record to refresh the link.
                </div>
              )}
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {lane.origin} → {lane.destination}
                <CargoPhotoPill status={booking.reviewStatus} />
              </CardTitle>
              <CardDescription>
                {tradeLabel(row)} · <span className="font-mono">{container.label}</span> ·{" "}
                {MODE_LABELS[lane.mode]} · {booking.requestedM3.toFixed(2)} m³ · €
                {amount.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="text-sm">
                <p className="font-medium">{booking.cargoPhotoLabel ?? "Untitled photograph"}</p>
                <p className="text-xs text-muted-foreground">
                  Submitted {formatWhen(booking.cargoPhotoUploadedAt)} · booking{" "}
                  <span className="font-mono">{booking.id}</span>
                </p>
              </div>
              {booking.reviewStatus === "rejected" && booking.reviewNote ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  Rejected — {booking.reviewNote}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onOpen(row)}>
                  <Camera className="size-4" />
                  {booking.reviewStatus === "pending" ? "Review photo" : "Open record"}
                </Button>
                <span className="text-xs text-muted-foreground">{traderName}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function tradeLabel(view: BookingView): string {
  return `${view.traderName} · ${view.providerName}`;
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
