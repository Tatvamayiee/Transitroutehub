import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  generateReport,
  listInsights,
  useServerData,
  type Insight,
  type ReportPayload,
} from "@/lib/api";
import { useCurrentUser, useToken } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & AI Enhancements — Transit Route Hub" },
      {
        name: "description",
        content:
          "Booking, revenue and lane utilisation reporting with a rules-based insight engine that flags capacity, escrow and verification risks.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ReportsPage,
});

const SEVERITY_TONE: Record<Insight["severity"], Tone> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

type ReportWindow = "30d" | "90d" | "all";

const WINDOW_LABEL: Record<ReportWindow, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

function ReportsPage() {
  const user = useCurrentUser();
  const token = useToken();
  const canSeeReports = user?.role === "provider" || user?.role === "admin";
  const [window, setWindow] = useState<ReportWindow>("90d");

  const report = useServerData<ReportPayload>(
    `report:${token ?? ""}:${window}`,
    () => generateReport(token ?? "", window),
    Boolean(token) && canSeeReports,
  );
  const insights = useServerData<Insight[]>(
    `insights:${token ?? ""}`,
    () => listInsights(token ?? ""),
    Boolean(token) && canSeeReports,
  );

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={BarChart3}
          title="Reports & AI enhancements"
          description="Operational reporting and an insight engine that turns live platform metrics into next actions."
        />
        <SignInGate what="Reporting" />
      </div>
    );
  }

  if (!canSeeReports) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ModuleHeader
          icon={BarChart3}
          title="Reports & AI enhancements"
          description="Reporting is available to providers and administrators."
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Provider and admin feature</CardTitle>
            <CardDescription>
              Traders get shipment-level views from Booking management and the escrow ledger
              instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link to="/bookings">My bookings</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/payments">Escrow ledger</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = report.data;
  const insightRows = insights.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={BarChart3}
        title="Reports & AI enhancements"
        description="Aggregate reporting across bookings, value and lane utilisation, plus a rules-based insight engine that surfaces what to do next."
        actions={
          <>
            <div className="flex gap-1">
              {(["30d", "90d", "all"] as ReportWindow[]).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={window === option ? "default" : "outline"}
                  onClick={() => setWindow(option)}
                >
                  {WINDOW_LABEL[option]}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                report.reload();
                insights.reload();
                toast.success("Report regenerated.");
              }}
            >
              <RefreshCw className="size-4" /> Regenerate
            </Button>
          </>
        }
      />

      {report.error ? (
        <div className="mt-6">
          <ErrorNote message={report.error} />
        </div>
      ) : null}

      {report.loading && !data ? (
        <LoadingRows label="Generating report…" />
      ) : data ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Bookings in window"
              value={String(data.summary.bookings)}
              hint={`${data.summary.bookingsPerLane} per lane`}
            />
            <StatCard
              label="Gross value"
              value={formatMoney(data.summary.grossValue)}
              hint={`${formatMoney(data.summary.escrowHeld)} still in escrow`}
            />
            <StatCard
              label="Avg utilisation"
              value={`${data.summary.avgUtilisationPct.toFixed(1)}%`}
              hint="Across all active capacity"
            />
            <StatCard
              label="Cancellation rate"
              value={`${data.summary.cancellationRatePct.toFixed(1)}%`}
              hint={`${formatMoney(data.summary.refunded)} refunded`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bookings by status</CardTitle>
                <CardDescription>Fulfilment funnel for the selected window.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.byStatus.map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">{row.value}</span>
                    </div>
                    <Progress
                      className="mt-1.5 h-2"
                      value={
                        data.summary.bookings > 0 ? (row.value / data.summary.bookings) * 100 : 0
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bookings by transport mode</CardTitle>
                <CardDescription>Where demand is concentrated.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.byMode.length === 0 ? (
                  <EmptyState title="No bookings in this window" />
                ) : (
                  data.byMode.map((row) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm">
                        <span>{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">{row.value}</span>
                      </div>
                      <Progress
                        className="mt-1.5 h-2"
                        value={
                          data.summary.bookings > 0 ? (row.value / data.summary.bookings) * 100 : 0
                        }
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Top lanes by value</CardTitle>
              <CardDescription>Booked volume and revenue per lane.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topLanes.length === 0 ? (
                <EmptyState title="No lane activity in this window" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lane</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Booked m³</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="w-40">Utilisation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topLanes.map((lane) => (
                      <TableRow key={lane.laneId}>
                        <TableCell className="font-medium">{lane.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{lane.bookings}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {lane.bookedM3.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(lane.value)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={lane.utilisationPct} className="h-2" />
                            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                              {lane.utilisationPct.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Provider performance</CardTitle>
              <CardDescription>Ranked by value carried in the window.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.byProvider.length === 0 ? (
                <EmptyState title="No provider activity in this window" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Shipped m³</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byProvider.map((row) => (
                      <TableRow key={row.providerId}>
                        <TableCell className="font-medium">{row.providerName}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.bookings}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.shippedM3.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> Insight engine
          </CardTitle>
          <CardDescription>
            Derived from live capacity, escrow and verification state — no external model call, so
            it works with no network. Recommendations are ranked by severity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.error ? <ErrorNote message={insights.error} /> : null}
          {insights.loading && !insights.data ? (
            <LoadingRows label="Analysing platform signals…" />
          ) : insightRows.length === 0 ? (
            <EmptyState
              title="No insights yet"
              description="List capacity and complete a booking to generate signals."
              action={
                <Button asChild variant="outline">
                  <Link to="/routes">Manage routes</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3">
              {insightRows.map((insight) => (
                <li key={insight.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="size-4 text-primary" />
                      <span className="font-medium">{insight.title}</span>
                    </div>
                    <StatusPill label={insight.severity} tone={SEVERITY_TONE[insight.severity]} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{insight.detail}</p>
                  <Separator className="my-2" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{insight.metric}</span>
                    <span className="text-muted-foreground">{insight.action}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
