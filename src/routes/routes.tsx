import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Container as ContainerIcon,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Route as RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/module-kit";
import {
  createContainer,
  createLane,
  listMyContainers,
  listMyLanes,
  providerBookings,
  updateContainer,
  useServerData,
  type BookingView,
  type Container,
  type Lane,
  type RouteMode,
} from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { MODE_LABELS } from "@/domain/types";
import { NetworkMap, type MapLane, type MapShipment } from "@/components/network-map";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Container & Route Management — Transit Route Hub" },
      {
        name: "description",
        content:
          "Publish lanes and container volume, adjust available cubic metres and price, and take capacity offline.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RouteManagementPage,
});

function RouteManagementPage() {
  const user = useCurrentUser();
  const token = useToken();
  const canManage = user?.role === "provider" || user?.role === "admin";

  const lanes = useServerData<Lane[]>(
    `my-lanes:${token ?? ""}`,
    () => listMyLanes(token ?? ""),
    Boolean(token) && canManage,
  );
  const containers = useServerData<Container[]>(
    `my-containers:${token ?? ""}`,
    () => listMyContainers(token ?? ""),
    Boolean(token) && canManage,
  );
  const shipments = useServerData<BookingView[]>(
    `route-shipments:${token ?? ""}`,
    () => providerBookings(token ?? ""),
    Boolean(token) && canManage,
  );

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <ModuleHeader
          icon={RouteIcon}
          title="Container & route management"
          description="Publish the lanes you run and the residual volume you can carry. Capacity changes take effect in search immediately."
        />
        <SignInGate what="Route and container management" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <ModuleHeader
          icon={RouteIcon}
          title="Container & route management"
          description="Publish the lanes you run and the residual volume you can carry."
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Providers only</CardTitle>
            <CardDescription>
              You are signed in as {ROLE_LABELS[user.role]}. Traders book space instead — head to
              the search page to find capacity.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link to="/catalog">Search cargo space</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/bookings">My bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const laneList = lanes.data ?? [];
  const containerList = containers.data ?? [];

  function refreshAll() {
    lanes.reload();
    containers.reload();
  }

  const mapLanes: MapLane[] = laneList.map((lane) => ({
    id: lane.id,
    origin: lane.origin,
    destination: lane.destination,
    mode: lane.mode,
    badge: `${containerList.filter((container) => container.laneId === lane.id).length} container(s) listed`,
  }));
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={RouteIcon}
        title="Container & route management"
        description="Publish lanes, list residual container volume and keep availability and pricing current. Every change is validated against your ownership on the server."
        actions={
          <>
            <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
            <Button size="sm" variant="outline" onClick={refreshAll}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="My lanes" value={String(laneList.length)} icon={RouteIcon} />
        <StatCard label="My containers" value={String(containerList.length)} icon={ContainerIcon} />
        <StatCard
          label="Listed volume"
          value={`${containerList
            .filter((c) => c.status !== "inactive")
            .reduce((sum, c) => sum + c.availableM3, 0)
            .toFixed(1)} m³`}
          hint="Available across your active containers"
        />
      </div>

      {lanes.error ? (
        <div className="mt-6">
          <ErrorNote message={lanes.error} />
        </div>
      ) : null}
      {containers.error ? (
        <div className="mt-6">
          <ErrorNote message={containers.error} />
        </div>
      ) : null}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="size-4 text-primary" /> Network map
          </CardTitle>
          <CardDescription>
            Your lanes drawn between real cities, with active shipments overlaid. Click a line for
            details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NetworkMap lanes={mapLanes} shipments={mapShipments} height={420} />
        </CardContent>
      </Card>

      <Tabs defaultValue="containers" className="mt-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="lanes">Lanes</TabsTrigger>
          <TabsTrigger value="new-lane">New lane</TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ContainerIcon className="size-4 text-primary" /> Listed containers
              </CardTitle>
              <CardDescription>
                Adjust available volume, price per m³ or take a container offline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {containers.loading && !containers.data ? (
                <LoadingRows label="Loading your containers…" />
              ) : containerList.length === 0 ? (
                <EmptyState
                  title="No containers listed"
                  description="Publish a lane first, then add container volume to it."
                />
              ) : (
                <ContainerTable
                  containers={containerList}
                  onSaved={refreshAll}
                  token={token ?? ""}
                />
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4 text-primary" /> List new container volume
              </CardTitle>
              <CardDescription>
                Choose one of your lanes and describe the residual space you can carry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewContainerForm lanes={laneList} token={token ?? ""} onCreated={refreshAll} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lanes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RouteIcon className="size-4 text-primary" /> My lanes
              </CardTitle>
              <CardDescription>The scheduled routes you serve.</CardDescription>
            </CardHeader>
            <CardContent>
              {lanes.loading && !lanes.data ? (
                <LoadingRows label="Loading your lanes…" />
              ) : laneList.length === 0 ? (
                <EmptyState
                  title="No lanes yet"
                  description="Add your first lane from the New lane tab."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lane</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead className="text-right">Containers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laneList.map((lane) => (
                      <TableRow key={lane.id}>
                        <TableCell className="font-medium">
                          {lane.origin} → {lane.destination}
                        </TableCell>
                        <TableCell>{MODE_LABELS[lane.mode]}</TableCell>
                        <TableCell>{new Date(lane.scheduledAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {containerList.filter((c) => c.laneId === lane.id).length}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new-lane" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RouteIcon className="size-4 text-primary" /> Publish a lane
              </CardTitle>
              <CardDescription>
                Lanes appear in search as soon as you attach container volume to them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewLaneForm token={token ?? ""} onCreated={refreshAll} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewLaneForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<RouteMode>("road");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) {
      toast.error("Pick a departure date.");
      return;
    }
    setBusy(true);
    const result = await createLane({
      token,
      origin,
      destination,
      mode,
      scheduledAt: new Date(scheduledAt).toISOString(),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Lane published.");
    setOrigin("");
    setDestination("");
    setScheduledAt("");
    onCreated();
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor="l-origin">Origin</Label>
        <Input
          id="l-origin"
          required
          placeholder="Mumbai, IN"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-destination">Destination</Label>
        <Input
          id="l-destination"
          required
          placeholder="Rotterdam, NL"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-mode">Mode</Label>
        <Select value={mode} onValueChange={(value) => setMode(value as RouteMode)}>
          <SelectTrigger id="l-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-departure">Departure</Label>
        <Input
          id="l-departure"
          type="date"
          required
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Publishing…" : "Publish lane"}
        </Button>
      </div>
    </form>
  );
}

function NewContainerForm({
  lanes,
  token,
  onCreated,
}: {
  lanes: Lane[];
  token: string;
  onCreated: () => void;
}) {
  const [laneId, setLaneId] = useState("");
  const [label, setLabel] = useState("");
  const [capacityM3, setCapacityM3] = useState("25");
  const [availableM3, setAvailableM3] = useState("25");
  const [pricePerM3, setPricePerM3] = useState("95");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!laneId) {
      toast.error("Choose a lane for this container.");
      return;
    }
    const capacity = Number(capacityM3);
    const available = Number(availableM3);
    const price = Number(pricePerM3);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      toast.error("Capacity must be greater than zero.");
      return;
    }
    if (available > capacity) {
      toast.error("Available volume cannot exceed capacity.");
      return;
    }
    setBusy(true);
    const result = await createContainer({
      token,
      laneId,
      label,
      capacityM3: capacity,
      availableM3: available,
      pricePerM3: price,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Container ${result.value.label} listed.`);
    setLabel("");
    onCreated();
  }

  if (lanes.length === 0) {
    return (
      <EmptyState
        title="Publish a lane first"
        description="Containers are always attached to a scheduled lane."
      />
    );
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="c-lane">Lane</Label>
        <Select value={laneId} onValueChange={setLaneId}>
          <SelectTrigger id="c-lane">
            <SelectValue placeholder="Choose a lane" />
          </SelectTrigger>
          <SelectContent>
            {lanes.map((lane) => (
              <SelectItem key={lane.id} value={lane.id}>
                {lane.origin} → {lane.destination} ({MODE_LABELS[lane.mode]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-label">Container reference</Label>
        <Input
          id="c-label"
          required
          placeholder="MSKU-4412"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-price">Price per m³ (€)</Label>
        <Input
          id="c-price"
          type="number"
          min="0"
          step="1"
          value={pricePerM3}
          onChange={(e) => setPricePerM3(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-capacity">Total capacity (m³)</Label>
        <Input
          id="c-capacity"
          type="number"
          min="0.1"
          step="0.1"
          value={capacityM3}
          onChange={(e) => setCapacityM3(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-available">Available now (m³)</Label>
        <Input
          id="c-available"
          type="number"
          min="0"
          step="0.1"
          value={availableM3}
          onChange={(e) => setAvailableM3(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Listing…" : "List container space"}
        </Button>
      </div>
    </form>
  );
}

function ContainerTable({
  containers,
  token,
  onSaved,
}: {
  containers: Container[];
  token: string;
  onSaved: () => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Container</TableHead>
          <TableHead className="text-right">Capacity</TableHead>
          <TableHead className="w-32">Available m³</TableHead>
          <TableHead className="w-28">€/m³</TableHead>
          <TableHead className="w-32">Status</TableHead>
          <TableHead className="text-right">Save</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {containers.map((container) => (
          <ContainerRow key={container.id} container={container} token={token} onSaved={onSaved} />
        ))}
      </TableBody>
    </Table>
  );
}

function ContainerRow({
  container,
  token,
  onSaved,
}: {
  container: Container;
  token: string;
  onSaved: () => void;
}) {
  const [availableM3, setAvailableM3] = useState(String(container.availableM3));
  const [pricePerM3, setPricePerM3] = useState(String(container.pricePerM3));
  const [status, setStatus] = useState<"available" | "inactive">(
    container.status === "inactive" ? "inactive" : "available",
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    const available = Number(availableM3);
    const price = Number(pricePerM3);
    if (!Number.isFinite(available) || available < 0) {
      toast.error("Available volume must be zero or more.");
      return;
    }
    setBusy(true);
    const result = await updateContainer({
      token,
      containerId: container.id,
      availableM3: available,
      pricePerM3: price,
      status,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`${container.label} updated.`);
    onSaved();
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-mono text-xs">{container.label}</div>
        <div className="mt-1">
          <StatusPill
            label={container.status}
            tone={
              container.status === "available"
                ? "success"
                : container.status === "booked"
                  ? "warning"
                  : "neutral"
            }
          />
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{container.capacityM3.toFixed(1)}</TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.1"
          aria-label={`Available volume for ${container.label}`}
          value={availableM3}
          onChange={(e) => setAvailableM3(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="1"
          aria-label={`Price per cubic metre for ${container.label}`}
          value={pricePerM3}
          onChange={(e) => setPricePerM3(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as "available" | "inactive")}
        >
          <SelectTrigger aria-label={`Status for ${container.label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="inactive">Offline</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
