import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  cancelBooking,
  myBookings,
  providerBookings,
  updateBookingStatus,
  useServerData,
  type BookingStatus,
  type BookingView,
} from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { BOOKING_STATUS_LABELS, MODE_LABELS } from "@/domain/types";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "Booking Management — Transit Route Hub" },
      {
        name: "description",
        content:
          "Track booked capacity, advance shipment status and cancel with automatic capacity release.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: BookingsPage,
});

const STATUS_TONE: Record<BookingStatus, Tone> = {
  pending: "warning",
  confirmed: "info",
  in_transit: "info",
  delivered: "success",
  cancelled: "danger",
};

function BookingsPage() {
  const user = useCurrentUser();
  const token = useToken();

  const outbound = useServerData<BookingView[]>(
    `my-bookings:${token ?? ""}`,
    () => myBookings(token ?? ""),
    Boolean(token) && user?.role !== "provider",
  );
  const inbound = useServerData<BookingView[]>(
    `provider-bookings:${token ?? ""}`,
    () => providerBookings(token ?? ""),
    Boolean(token) && (user?.role === "provider" || user?.role === "admin"),
  );

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={ClipboardList}
          title="Booking management"
          description="Every booking you placed or received, with shipment status and escrow state."
        />
        <SignInGate what="Booking management" />
      </div>
    );
  }

  const isProvider = user.role === "provider" || user.role === "admin";
  const activeRows = isProvider ? (inbound.data ?? []) : (outbound.data ?? []);
  const loading = isProvider ? inbound.loading : outbound.loading;
  const error = isProvider ? inbound.error : outbound.error;

  function reload() {
    outbound.reload();
    inbound.reload();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={ClipboardList}
        title="Booking management"
        description="Advance shipments, cancel with automatic capacity release, and follow escrow state. Status changes are restricted to the parties on the booking."
        actions={
          <>
            <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
            <Button size="sm" variant="outline" onClick={reload}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button asChild size="sm">
              <Link to="/payments">Escrow</Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={isProvider ? "Inbound bookings" : "My bookings"}
          value={String(activeRows.length)}
          icon={ClipboardList}
        />
        <StatCard
          label="In transit"
          value={String(activeRows.filter((r) => r.booking.status === "in_transit").length)}
        />
        <StatCard
          label="Escrow held"
          value={`€${activeRows
            .filter((r) => r.paymentStatus === "funded")
            .reduce((sum, r) => sum + r.amount, 0)
            .toFixed(2)}`}
          hint="Funds awaiting release"
        />
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <Tabs defaultValue={isProvider ? "inbound" : "outbound"} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          {isProvider ? <TabsTrigger value="inbound">Inbound</TabsTrigger> : null}
          <TabsTrigger value="outbound">My bookings</TabsTrigger>
        </TabsList>

        {isProvider ? (
          <TabsContent value="inbound" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bookings on your capacity</CardTitle>
                <CardDescription>
                  Mark shipments in transit or delivered. Delivered unlocks escrow release for the
                  trader.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading && !inbound.data ? (
                  <LoadingRows label="Loading inbound bookings…" />
                ) : (inbound.data ?? []).length === 0 ? (
                  <EmptyState
                    title="No inbound bookings yet"
                    description="Once traders book your listed volume they will appear here."
                  />
                ) : (
                  <BookingTable
                    rows={inbound.data ?? []}
                    mode="provider"
                    token={token ?? ""}
                    onChanged={reload}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="outbound" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My booked space</CardTitle>
              <CardDescription>
                Cancel while a shipment is still pending or confirmed and the volume returns to the
                pool automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {outbound.loading && !outbound.data ? (
                <LoadingRows label="Loading your bookings…" />
              ) : (outbound.data ?? []).length === 0 ? (
                <EmptyState
                  title="No bookings yet"
                  description="Search available capacity and book the space you need."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/catalog">Search cargo space</Link>
                    </Button>
                  }
                />
              ) : (
                <BookingTable
                  rows={outbound.data ?? []}
                  mode="trader"
                  token={token ?? ""}
                  onChanged={reload}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingTable({
  rows,
  mode,
  token,
  onChanged,
}: {
  rows: BookingView[];
  mode: "trader" | "provider";
  token: string;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function advance(bookingId: string, status: BookingStatus) {
    setBusyId(bookingId);
    const result = await updateBookingStatus({ token, bookingId, status });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Booking ${bookingId} is now ${BOOKING_STATUS_LABELS[status].toLowerCase()}.`);
    onChanged();
  }

  async function cancel(bookingId: string) {
    setBusyId(bookingId);
    const result = await cancelBooking({
      token,
      bookingId,
      reason: mode === "provider" ? "Cancelled by provider." : "Cancelled by trader.",
    });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Booking cancelled and capacity released.");
    onChanged();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Shipment</TableHead>
          {mode === "provider" ? <TableHead>Trader</TableHead> : <TableHead>Provider</TableHead>}
          <TableHead className="text-right">Volume</TableHead>
          <TableHead className="text-right">Escrow</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ booking, container, lane, providerName, traderName }) => (
          <TableRow key={booking.id}>
            <TableCell>
              <div className="font-medium">
                {lane.origin} → {lane.destination}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{container.label}</span> · {container.id} ·{" "}
                {MODE_LABELS[lane.mode]}
              </div>
            </TableCell>
            <TableCell className="text-sm">
              {mode === "provider" ? traderName : providerName}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {booking.requestedM3.toFixed(2)} m³
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">{booking.id}</TableCell>
            <TableCell>
              <StatusPill
                label={BOOKING_STATUS_LABELS[booking.status]}
                tone={STATUS_TONE[booking.status]}
              />
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap justify-end gap-1.5">
                {mode === "provider" ? (
                  <>
                    {booking.status === "confirmed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === booking.id}
                        onClick={() => advance(booking.id, "in_transit")}
                      >
                        Mark in transit
                      </Button>
                    ) : null}
                    {booking.status === "in_transit" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === booking.id}
                        onClick={() => advance(booking.id, "delivered")}
                      >
                        Mark delivered
                      </Button>
                    ) : null}
                  </>
                ) : null}
                <Button size="sm" variant="outline" asChild>
                  <Link to="/loading" search={{ booking: booking.id }}>
                    Load plan
                  </Link>
                </Button>
                {booking.status !== "cancelled" && booking.status !== "delivered" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === booking.id}
                    onClick={() => cancel(booking.id)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
