import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, Gauge, Map as NetworkIcon, Network, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  StatCard,
  StatusPill,
} from "@/components/module-kit";
import {
  aggregateCapacity,
  listLanes,
  myBookings,
  providerBookings,
  useServerData,
  type BookingView,
  type Lane,
} from "@/lib/api";
import { useCurrentUser, useToken } from "@/lib/auth";
import { NetworkMap, type MapLane, type MapShipment } from "@/components/network-map";
import { MODE_LABELS } from "@/domain/types";

export const Route = createFileRoute("/aggregation")({
  head: () => ({
    meta: [
      { title: "Cargo Space Aggregation — Transit Route Hub" },
      {
        name: "description",
        content:
          "Network-wide roll-up of residual container volume, utilisation and cheapest price per lane and transport mode.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AggregationPage,
});

function AggregationPage() {
  const user = useCurrentUser();
  const token = useToken();
  const { data, error, loading, reload } = useServerData("aggregation", aggregateCapacity);
  const [sortKey, setSortKey] = useState<"utilisation" | "available" | "price">("utilisation");

  // The full network always lists; shipments are only visible to the party involved.
  const allLanes = useServerData<Lane[]>("aggregation-lanes", listLanes);
  const shipments = useServerData<BookingView[]>(
    `aggregation-shipments:${token ?? ""}:${user?.role ?? "anon"}`,
    () => (user?.role === "trader" ? myBookings(token ?? "") : providerBookings(token ?? "")),
    Boolean(token),
  );
  const activeStatuses = new Set(["pending", "confirmed", "in_transit"]);
  const mapShipments: MapShipment[] = (shipments.data ?? [])
    .filter((row) => activeStatuses.has(row.booking.status))
    .map((row) => ({
      id: row.booking.id,
      origin: row.lane.origin,
      destination: row.lane.destination,
      mode: row.lane.mode,
      status: row.booking.status,
      label: `${row.container.label} · ${row.booking.requestedM3.toFixed(1)} m³`,
    }));
  const mapLanes: MapLane[] = (allLanes.data ?? []).map((lane) => ({
    id: lane.id,
    origin: lane.origin,
    destination: lane.destination,
    mode: lane.mode,
  }));

  const lanes = data
    ? [...data.aggregatedLanes].sort((a, b) => {
        if (sortKey === "available") return b.availableM3 - a.availableM3;
        if (sortKey === "price") return a.cheapestPricePerM3 - b.cheapestPricePerM3;
        return b.utilisationPct - a.utilisationPct;
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={Network}
        title="Cargo space aggregation"
        description="Every partially filled container on the network, rolled up by lane and mode. This is the pooled inventory that the search engine and booking flow draw from."
        actions={
          <>
            <StatusPill
              label={user ? "Signed in" : "Public view"}
              tone={user ? "success" : "neutral"}
            />
            <Button size="sm" variant="outline" onClick={reload}>
              Refresh
            </Button>
            <Button asChild size="sm">
              <Link to="/catalog">Search &amp; book</Link>
            </Button>
          </>
        }
      />

      {error ? (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {loading && !data ? (
        <LoadingRows label="Aggregating network capacity…" />
      ) : data ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Pooled capacity"
              value={`${data.totalCapacityM3.toFixed(1)} m³`}
              hint={`${data.containerCount} active container(s)`}
              icon={Boxes}
            />
            <StatCard
              label="Available right now"
              value={`${data.totalAvailableM3.toFixed(1)} m³`}
              hint="Bookable residual volume"
              icon={TrendingUp}
            />
            <StatCard
              label="Network utilisation"
              value={`${data.utilisationPct.toFixed(1)}%`}
              hint="Pooled capacity already committed"
              icon={Gauge}
            />
            <StatCard
              label="Active lanes"
              value={String(data.laneCount)}
              hint="Routes with listed space"
              icon={Network}
            />
          </div>

          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <NetworkIcon className="size-4 text-primary" /> Network map
              </CardTitle>
              <CardDescription>
                Every published lane drawn between real cities. Active shipments are overlaid in
                status colour — click a line or dot for detail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NetworkMap lanes={mapLanes} shipments={mapShipments} height={440} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Capacity by transport mode</CardTitle>
              <CardDescription>
                How the pooled cubic metres are distributed across modes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {data.byMode.map((row) => {
                const utilisation =
                  row.capacityM3 > 0
                    ? ((row.capacityM3 - row.availableM3) / row.capacityM3) * 100
                    : 0;
                return (
                  <div key={row.mode} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{MODE_LABELS[row.mode]}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.containerCount} container(s)
                      </span>
                    </div>
                    <Progress className="mt-3" value={utilisation} />
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>{row.availableM3.toFixed(1)} m³ free</span>
                      <span>{utilisation.toFixed(0)}% utilised</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Lane breakdown</CardTitle>
                <CardDescription>Ranked by the selected column.</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={sortKey === "utilisation" ? "default" : "outline"}
                  onClick={() => setSortKey("utilisation")}
                >
                  Utilisation
                </Button>
                <Button
                  size="sm"
                  variant={sortKey === "available" ? "default" : "outline"}
                  onClick={() => setSortKey("available")}
                >
                  Free volume
                </Button>
                <Button
                  size="sm"
                  variant={sortKey === "price" ? "default" : "outline"}
                  onClick={() => setSortKey("price")}
                >
                  Price
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lanes.length === 0 ? (
                <EmptyState
                  title="No active lanes yet"
                  description="Providers need to publish container space before it can be aggregated."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/routes">Open route management</Link>
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lane</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Containers</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Free</TableHead>
                      <TableHead className="text-right">From €/m³</TableHead>
                      <TableHead className="w-40">Utilisation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lanes.map((row) => (
                      <TableRow key={row.lane.id}>
                        <TableCell className="font-medium">
                          {row.lane.origin} → {row.lane.destination}
                        </TableCell>
                        <TableCell>{MODE_LABELS[row.lane.mode]}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.providerName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.containerCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.capacityM3.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.availableM3.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          €{row.cheapestPricePerM3.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={row.utilisationPct} className="h-2" />
                            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                              {row.utilisationPct.toFixed(0)}%
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
        </>
      ) : null}
    </div>
  );
}
