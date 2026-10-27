import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, ShieldCheck, Wallet, RefreshCw } from "lucide-react";
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
  fundEscrow,
  listLedger,
  refundEscrow,
  releaseEscrow,
  useServerData,
  type BookingView,
} from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PAYMENT_STATUS_LABELS } from "@/domain/types";
import type { PaymentStatus } from "@/domain/types";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payment & Escrow — Transit Route Hub" },
      {
        name: "description",
        content:
          "Fund escrow on a booking, release it to the provider on delivery, or refund it when a shipment is cancelled.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PaymentsPage,
});

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  unfunded: "warning",
  funded: "info",
  released: "success",
  refunded: "neutral",
};

function PaymentsPage() {
  const user = useCurrentUser();
  const token = useToken();
  const ledger = useServerData<BookingView[]>(
    `ledger:${token ?? ""}`,
    () => listLedger(token ?? ""),
    Boolean(token),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <ModuleHeader
          icon={Wallet}
          title="Payment & escrow"
          description="Funds are held against a booking and only released once delivery is confirmed."
        />
        <SignInGate what="The escrow ledger" />
      </div>
    );
  }

  const rows = ledger.data ?? [];

  async function act(
    bookingId: string,
    label: string,
    action: (token: string, bookingId: string) => ReturnType<typeof fundEscrow>,
  ) {
    setBusyId(bookingId);
    const result = await action(token ?? "", bookingId);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`${label} — ${formatMoney(result.value.amount)}.`);
    ledger.reload();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={Wallet}
        title="Payment & escrow"
        description="Escrow protects both sides: the trader funds before dispatch, the provider is paid when delivery is confirmed. Cancelling a booking refunds held funds."
        actions={
          <>
            <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
            <Button size="sm" variant="outline" onClick={ledger.reload}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/bookings">Bookings</Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Held in escrow"
          value={formatMoney(
            rows.filter((r) => r.paymentStatus === "funded").reduce((sum, r) => sum + r.amount, 0),
          )}
          hint="Awaiting delivery confirmation"
          icon={Lock}
        />
        <StatCard
          label="Released"
          value={formatMoney(
            rows
              .filter((r) => r.paymentStatus === "released")
              .reduce((sum, r) => sum + r.amount, 0),
          )}
          hint="Paid out to providers"
          icon={ShieldCheck}
        />
        <StatCard
          label="Refunded"
          value={formatMoney(
            rows
              .filter((r) => r.paymentStatus === "refunded")
              .reduce((sum, r) => sum + r.amount, 0),
          )}
          hint="Returned after cancellation"
        />
      </div>

      {ledger.error ? (
        <div className="mt-6">
          <ErrorNote message={ledger.error} />
        </div>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Escrow ledger</CardTitle>
          <CardDescription>
            Every payment attached to a booking you are party to.
            {user.role === "admin"
              ? " As an administrator you also see the platform-wide ledger."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.loading && !ledger.data ? (
            <LoadingRows label="Loading the ledger…" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Escrow entries are created automatically when you book space."
              action={
                <Button asChild variant="outline">
                  <Link to="/catalog">Search cargo space</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Escrow status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(
                  ({
                    booking,
                    container,
                    lane,
                    providerName,
                    traderName,
                    paymentStatus,
                    amount,
                  }) => {
                    const isTrader = booking.userId === user.id;
                    const isAdmin = user.role === "admin";
                    return (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div className="font-medium">
                            {lane.origin} → {lane.destination}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{container.label}</span> ·{" "}
                            {booking.requestedM3.toFixed(2)} m³ · {booking.status.replace("_", " ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {isTrader ? providerName : traderName}
                          <div className="text-xs text-muted-foreground">
                            {isTrader ? "Provider" : "Trader"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(amount)}
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            label={PAYMENT_STATUS_LABELS[paymentStatus]}
                            tone={STATUS_TONE[paymentStatus]}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {paymentStatus === "unfunded" && (isTrader || isAdmin) ? (
                              <Button
                                size="sm"
                                disabled={busyId === booking.id}
                                onClick={() => act(booking.id, "Escrow funded", fundEscrow)}
                              >
                                Fund escrow
                              </Button>
                            ) : null}
                            {paymentStatus === "funded" && (isTrader || isAdmin) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === booking.id}
                                onClick={() => act(booking.id, "Escrow released", releaseEscrow)}
                              >
                                Release funds
                              </Button>
                            ) : null}
                            {isAdmin && paymentStatus === "funded" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === booking.id}
                                onClick={() => act(booking.id, "Escrow refunded", refundEscrow)}
                              >
                                Refund
                              </Button>
                            ) : null}
                            {paymentStatus === "released" || paymentStatus === "refunded" ? (
                              <span className="text-xs text-muted-foreground">Settled</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          )}
          {user.role === "provider" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Only the trader on a shipment (or an administrator) can fund and release escrow.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
