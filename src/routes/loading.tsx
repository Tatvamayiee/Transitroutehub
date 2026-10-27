import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Boxes,
  Move3d,
  PackagePlus,
  RotateCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Weight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  ErrorNote,
  LoadingRows,
  ModuleHeader,
  SignInGate,
  StatCard,
  StatusPill,
} from "@/components/module-kit";
import { ContainerScene, type ViewPreset } from "@/components/container-scene";
import {
  addCargoBox,
  allBookings,
  autoPackBooking,
  loadPlan,
  moveCargoBox,
  myBookings,
  providerBookings,
  removeCargoBox,
  resetLoadPlan,
  useServerData,
  type BookingView,
  type CargoInput,
  type LoadPlan,
  type Placement,
} from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import {
  boxVolumeM3,
  checkPlacement,
  firstClearY,
  footprint,
  type CargoBox,
} from "@/domain/loading";

type LoadingSearch = { booking: string | undefined };

export const Route = createFileRoute("/loading")({
  validateSearch: (search: Record<string, unknown>): LoadingSearch => ({
    booking: typeof search["booking"] === "string" ? (search["booking"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "3D Container Load Plan — Transit Route Hub" },
      {
        name: "description",
        content:
          "Place your cargo inside the container in 3D: auto-pack by volume, then drag packages to fine-tune the load.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LoadingPage,
});

const EMPTY_PACKAGE: CargoInput = {
  label: "",
  lengthCm: 120,
  widthCm: 100,
  heightCm: 150,
  weightKg: 400,
  fragile: false,
};

function LoadingPage() {
  const user = useCurrentUser();
  const token = useToken();
  const search = Route.useSearch();

  const bookings = useServerData<BookingView[]>(
    `loading-bookings:${token ?? ""}:${user?.role ?? "anon"}`,
    () => {
      if (user?.role === "admin") return allBookings(token ?? "");
      if (user?.role === "provider") return providerBookings(token ?? "");
      return myBookings(token ?? "");
    },
    Boolean(token),
  );

  const options = useMemo(
    () =>
      (bookings.data ?? [])
        .filter((row) => row.booking.status !== "cancelled")
        .map((row) => ({
          id: row.booking.id,
          label: `${row.container.label} · ${row.lane.origin} → ${row.lane.destination}`,
          volume: row.booking.requestedM3,
        })),
    [bookings.data],
  );

  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBooking) return;
    const fromSearch = search.booking && options.some((row) => row.id === search.booking);
    setSelectedBooking(fromSearch ? (search.booking as string) : (options[0]?.id ?? null));
  }, [options, search.booking, selectedBooking]);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={Boxes}
          title="3D container load plan"
          description="See exactly where every package lands inside the container before it ships."
        />
        <SignInGate what="The 3D load planner" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={Boxes}
        title="3D container load plan"
        description="Your booked volume becomes a real pallet plan: auto-pack it, then drag any package to adjust the load. Placements are validated on the server so nothing can overlap, and the provider on the booking is notified whenever the plan changes."
        actions={
          <>
            <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
            <Button asChild size="sm" variant="outline">
              <Link to="/bookings">Bookings</Link>
            </Button>
          </>
        }
      />

      {bookings.loading && !bookings.data ? (
        <LoadingRows label="Loading your shipments…" />
      ) : bookings.error ? (
        <div className="mt-6">
          <ErrorNote message={bookings.error} />
        </div>
      ) : options.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No shipments to load yet"
            description="Book cargo space first — the load plan is built from a confirmed booking."
            action={
              <Button asChild variant="outline">
                <Link to="/catalog">Search cargo space</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Shipment</span>
              <select
                value={selectedBooking ?? ""}
                onChange={(event) => setSelectedBooking(event.target.value)}
                className="h-9 min-w-72 rounded-md border border-input bg-background px-3 text-sm"
              >
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.volume.toFixed(1)} m³
                  </option>
                ))}
              </select>
            </label>
            {selectedBooking ? (
              <span className="pb-2 text-xs text-muted-foreground">
                Booking <span className="font-mono">{selectedBooking}</span>
              </span>
            ) : null}
          </div>

          {selectedBooking && token ? (
            <LoadPlanPanel token={token} bookingId={selectedBooking} />
          ) : null}
        </>
      )}
    </div>
  );
}

function LoadPlanPanel({ token, bookingId }: { token: string; bookingId: string }) {
  const user = useCurrentUser();
  const query = useServerData<LoadPlan>(`load-plan:${token}:${bookingId}`, () =>
    loadPlan(token, bookingId),
  );
  const [plan, setPlan] = useState<LoadPlan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<{ preset: ViewPreset; nonce: number }>({
    preset: "iso",
    nonce: 0,
  });

  useEffect(() => {
    if (query.data) setPlan(query.data);
  }, [query.data]);

  useEffect(() => {
    setPlan(null);
    setSelectedId(null);
  }, [bookingId]);

  if (query.loading && !plan) return <LoadingRows label="Building the load plan…" />;
  if (query.error) return <ErrorNote message={query.error} />;
  if (!plan) return <LoadingRows label="Building the load plan…" />;

  const selected = plan.boxes.find((box) => box.id === selectedId) ?? null;
  const stats = plan.stats;

  async function run(promise: Promise<Awaited<ReturnType<typeof loadPlan>>>, message: string) {
    setBusy(true);
    const result = await promise;
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPlan(result.value);
    toast.success(message);
  }

  async function move(id: string, placement: Placement) {
    if (!plan) return;
    // If the target intersects other cargo, rest the package on top of whatever is
    // in the way instead of rejecting — this is what makes stacking reachable:
    // a 5 cm Raise step (or a floor-level drag) through a taller neighbour would
    // otherwise be rejected at every intermediate height.
    let target = placement;
    if (!checkPlacement(plan.spec, plan.boxes, id, placement).ok) {
      const clearY = firstClearY(plan.spec, plan.boxes, id, placement);
      if (clearY !== null && clearY > placement.yCm) target = { ...placement, yCm: clearY };
      // No clear height above: send as-is so the server returns its precise reason.
    }
    const result = await moveCargoBox(token, id, target);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPlan(result.value);
  }

  function nudge(box: CargoBox, axis: "x" | "z" | "y", delta: number) {
    if (!box.placement) return;
    const next: Placement = { ...box.placement };
    if (axis === "x") next.xCm += delta;
    if (axis === "z") next.zCm += delta;
    if (axis === "y") next.yCm = Math.max(0, next.yCm + delta);
    void move(box.id, next);
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Loaded volume"
            value={`${stats.placedVolumeM3.toFixed(2)} m³`}
            hint={`${stats.fillOfBookedPct.toFixed(0)}% of ${plan.bookedM3.toFixed(1)} m³ booked`}
            icon={Boxes}
          />
          <StatCard
            label="Container fill"
            value={`${stats.fillOfContainerPct.toFixed(1)}%`}
            hint={`${plan.containerKind}`}
            icon={Sparkles}
          />
          <StatCard
            label="Gross weight"
            value={`${Math.round(stats.totalWeightKg).toLocaleString()} kg`}
            hint={`${stats.payloadPct.toFixed(0)}% of payload`}
            icon={Weight}
          />
          <StatCard
            label="Packages"
            value={`${stats.placedCount}/${plan.boxes.length}`}
            hint={
              stats.unplacedCount > 0 ? `${stats.unplacedCount} could not be loaded` : "All loaded"
            }
            icon={Move3d}
          />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">
                {plan.containerLabel} · {stats.maxHeightCm.toFixed(0)} cm high
              </CardTitle>
              <CardDescription>
                {plan.spec.lengthCm} × {plan.spec.widthCm} × {plan.spec.heightCm} cm interior · drag
                to orbit, scroll to zoom, drag a package to move it
                {plan.lastPackedAt ? (
                  <> · last updated {new Date(plan.lastPackedAt).toLocaleString()}</>
                ) : null}
              </CardDescription>
              {user?.role === "provider" || user?.role === "admin" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.traderName}&apos;s placement for this booking — the same boxes they arranged
                  in the 3D planner. You can adjust the load here too.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["iso", "top", "side", "doors"] as ViewPreset[]).map((view) => (
                <Button
                  key={view}
                  size="sm"
                  variant="outline"
                  onClick={() => setPreset({ preset: view, nonce: Date.now() })}
                >
                  {view === "iso"
                    ? "3D"
                    : view === "top"
                      ? "Top"
                      : view === "side"
                        ? "Side"
                        : "Doors"}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(autoPackBooking(token, bookingId), "Auto-packed the load.")}
              >
                Auto-pack
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(resetLoadPlan(token, bookingId), "Load plan rebuilt from the booked volume.")
                }
              >
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ContainerScene
              spec={plan.spec}
              boxes={plan.boxes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={move}
              viewPreset={preset}
              height={430}
              className="w-full overflow-hidden rounded-lg border border-border/60 bg-[linear-gradient(160deg,oklch(0.98_0.01_205),oklch(0.94_0.02_205))]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[hsl(199_58%_50%)]" /> Cargo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,hsl(168_42%_46%),hsl(168_42%_46%)_2px,white_2px,white_4px)]" />{" "}
                Fragile
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-red-500" /> Centre of
                gravity
              </span>
              <span className="ml-auto">
                Floor used {stats.floorAreaUsedM2.toFixed(1)} / {stats.floorAreaM2.toFixed(1)} m²
              </span>
            </div>
          </CardContent>
        </Card>

        {stats.warnings.length > 0 ? (
          <div className="grid gap-2">
            {stats.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Packages</CardTitle>
            <CardDescription>
              Dimensions in centimetres. Editing a size re-fits that package automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Package</th>
                  <th className="py-2 pr-3 font-medium">L × W × H</th>
                  <th className="py-2 pr-3 text-right font-medium">m³</th>
                  <th className="py-2 pr-3 text-right font-medium">kg</th>
                  <th className="py-2 pr-3 font-medium">Placement</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plan.boxes.map((box) => {
                  const bounds = box.placement;
                  const dims = footprint(box);
                  return (
                    <tr
                      key={box.id}
                      className={
                        box.id === selectedId
                          ? "border-b border-border/60 bg-secondary/60"
                          : "border-b border-border/40"
                      }
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(box.id)}
                          className="text-left font-medium hover:underline"
                        >
                          {box.label}
                        </button>
                        {box.fragile ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600">
                            fragile
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                        {box.lengthCm} × {box.widthCm} × {box.heightCm}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {boxVolumeM3(box).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{box.weightKg}</td>
                      <td className="py-2 pr-3">
                        {bounds ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            x{bounds.xCm} y{bounds.yCm} z{bounds.zCm}
                            {bounds.rotated ? " ↻" : ""} ({dims.l}×{dims.w})
                          </span>
                        ) : (
                          <StatusPill label="not loaded" tone="warning" />
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Rotate 90 degrees"
                            disabled={busy || !bounds}
                            onClick={() =>
                              bounds && void move(box.id, { ...bounds, rotated: !bounds.rotated })
                            }
                          >
                            <RotateCw className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Remove package"
                            disabled={busy}
                            onClick={() => run(removeCargoBox(token, box.id), "Package removed.")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 content-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selected package</CardTitle>
            <CardDescription>
              {selected ? selected.label : "Click a package in the 3D view or the table."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected?.placement ? (
              <SelectedPackageEditor
                box={selected}
                busy={busy}
                onNudge={(axis, delta) => nudge(selected, axis, delta)}
                onRotate={() =>
                  void move(selected.id, {
                    ...(selected.placement as Placement),
                    rotated: !(selected.placement as Placement).rotated,
                  })
                }
                onDrop={() =>
                  void move(selected.id, { ...(selected.placement as Placement), yCm: 0 })
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {selected
                  ? "This package is not loaded — shrink its neighbours or add space."
                  : "Nothing selected."}
              </p>
            )}
          </CardContent>
        </Card>

        <AddPackageCard token={token} bookingId={bookingId} onAdded={setPlan} />
      </div>
    </div>
  );
}

function SelectedPackageEditor({
  box,
  busy,
  onNudge,
  onRotate,
  onDrop,
}: {
  box: CargoBox;
  busy: boolean;
  onNudge: (axis: "x" | "z" | "y", delta: number) => void;
  onRotate: () => void;
  onDrop: () => void;
}) {
  const placement = box.placement as Placement;
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <div className="rounded-md border border-border/60 py-1.5">
          <div className="text-[10px] uppercase tracking-wide">x · length</div>
          <div className="font-mono text-sm text-foreground">{placement.xCm}</div>
        </div>
        <div className="rounded-md border border-border/60 py-1.5">
          <div className="text-[10px] uppercase tracking-wide">y · height</div>
          <div className="font-mono text-sm text-foreground">{placement.yCm}</div>
        </div>
        <div className="rounded-md border border-border/60 py-1.5">
          <div className="text-[10px] uppercase tracking-wide">z · width</div>
          <div className="font-mono text-sm text-foreground">{placement.zCm}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-label="Move 5 cm toward the nose"
          disabled={busy}
          onClick={() => onNudge("x", -5)}
        >
          <ArrowLeft className="size-4" /> 5
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Move 5 cm toward the doors"
          disabled={busy}
          onClick={() => onNudge("x", 5)}
        >
          5 <ArrowRight className="size-4" />
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onDrop}>
          To floor
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Move 5 cm left"
          disabled={busy}
          onClick={() => onNudge("z", -5)}
        >
          <ArrowUp className="size-4" /> 5
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Move 5 cm right"
          disabled={busy}
          onClick={() => onNudge("z", 5)}
        >
          5 <ArrowDown className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Raise 5 cm"
          disabled={busy}
          onClick={() => onNudge("y", 5)}
        >
          Raise 5
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onRotate}>
          <RotateCw className="size-4" /> Rotate 90°
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Lower 5 cm"
          disabled={busy || placement.yCm === 0}
          onClick={() => onNudge("y", -5)}
        >
          Lower 5
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Dragging moves a package along the floor; drop it onto another package to stack it on top.
        Raise/Lower adjusts the height.
      </p>
    </div>
  );
}

function AddPackageCard({
  token,
  bookingId,
  onAdded,
}: {
  token: string;
  bookingId: string;
  onAdded: (plan: LoadPlan) => void;
}) {
  const [form, setForm] = useState<CargoInput>(EMPTY_PACKAGE);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof CargoInput>(key: K, value: CargoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await addCargoBox(token, bookingId, form);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    onAdded(result.value);
    toast.success("Package added to the load plan.");
    setForm((prev) => ({ ...prev, label: "" }));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackagePlus className="size-4 text-primary" /> Add a package
        </CardTitle>
        <CardDescription>It is dropped into the first free space automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="pkg-label">Label</Label>
            <Input
              id="pkg-label"
              value={form.label}
              placeholder="e.g. Textile rolls 07"
              onChange={(event) => update("label", event.target.value)}
              maxLength={60}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["lengthCm", "L (cm)"],
                ["widthCm", "W (cm)"],
                ["heightCm", "H (cm)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={`pkg-${key}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`pkg-${key}`}
                  type="number"
                  min={1}
                  value={form[key]}
                  onChange={(event) => update(key, Number(event.target.value))}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-weight" className="text-xs">
                Weight (kg)
              </Label>
              <Input
                id="pkg-weight"
                type="number"
                min={0}
                value={form.weightKg}
                onChange={(event) => update("weightKg", Number(event.target.value))}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.fragile}
                onChange={(event) => update("fragile", event.target.checked)}
                className="size-4 rounded border-input"
              />
              Fragile
            </label>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add package"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
