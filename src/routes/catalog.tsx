import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Search, MapPin, ShieldCheck } from "lucide-react";
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
import {
  EmptyState,
  ErrorNote,
  LoadingRows,
  ModuleHeader,
  StatusPill,
} from "@/components/module-kit";
import { createBooking, searchSpace, type RouteMode, type SpaceListing } from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { MODE_LABELS } from "@/domain/types";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Cargo Search & Booking — Transit Route Hub" },
      {
        name: "description",
        content:
          "Search residual container volume by origin, destination and mode, then book the cubic metres you need.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CatalogPage,
});

type ModeFilter = RouteMode | "any";

function CatalogPage() {
  const user = useCurrentUser();
  const token = useToken();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<ModeFilter>("any");
  const [minM3, setMinM3] = useState("0.5");
  const [maxPrice, setMaxPrice] = useState("");

  const [listings, setListings] = useState<SpaceListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    const result = await searchSpace({
      origin,
      destination,
      mode,
      minM3: Number(minM3) || 0,
      maxPricePerM3: Number(maxPrice) || 0,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setListings(result.value);
  }

  async function book(containerId: string, requestedM3: number) {
    if (!token) {
      toast.error("Sign in as a trader to book space.");
      return;
    }
    setBookingId(containerId);
    const result = await createBooking({ token, containerId, requestedM3 });
    setBookingId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Booked ${requestedM3.toFixed(2)} m³. Fund escrow to secure the shipment.`);
    void runSearch();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <ModuleHeader
        icon={Search}
        title="Cargo search & booking"
        description="Search residual volume across every verified lane, compare price per m³, and book instantly. Bookings hold capacity on the server."
        actions={
          <>
            <StatusPill
              label={user ? ROLE_LABELS[user.role] : "Not signed in"}
              tone={user ? "info" : "neutral"}
            />
            {!user ? (
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link to="/bookings">Bookings</Link>
              </Button>
            )}
          </>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Search available space</CardTitle>
          <CardDescription>
            Filters are applied on the server against live capacity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={runSearch}>
            <div className="grid gap-2">
              <Label htmlFor="f-origin">From</Label>
              <Input
                id="f-origin"
                placeholder="Mumbai"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-destination">To</Label>
              <Input
                id="f-destination"
                placeholder="Rotterdam"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-mode">Mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as ModeFilter)}>
                <SelectTrigger id="f-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any mode</SelectItem>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-min">Minimum m³</Label>
              <Input
                id="f-min"
                type="number"
                min="0"
                step="0.1"
                value={minM3}
                onChange={(e) => setMinM3(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-price">Max ₹/m³</Label>
              <Input
                id="f-price"
                type="number"
                min="0"
                step="1"
                placeholder="Any"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button type="submit" disabled={loading}>
                <Search className="size-4" /> {loading ? "Searching…" : "Search space"}
              </Button>
            </div>
          </form>
          {error ? (
            <div className="mt-4">
              <ErrorNote message={error} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" /> Results
          </CardTitle>
          <CardDescription>
            {listings === null
              ? "Run a search to see matching containers."
              : `${listings.length} container(s) match — cheapest first.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingRows label="Searching available volume…" />
          ) : listings === null ? (
            <EmptyState
              title="No search yet"
              description="Use the filters above, or search with no filters to browse every open container."
              action={
                <Button variant="outline" onClick={() => void runSearch()}>
                  Show all available space
                </Button>
              }
            />
          ) : listings.length === 0 ? (
            <EmptyState
              title="No space matches those filters"
              description="Try widening the destination, lowering the minimum volume, or removing the price cap."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">₹/m³</TableHead>
                  <TableHead className="text-right">Book m³</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map(({ container, lane, providerName, providerVerified }) => (
                  <TableRow key={container.id}>
                    <TableCell>
                      <div className="font-medium">
                        {lane.origin} → {lane.destination}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {MODE_LABELS[lane.mode]} · {new Date(lane.scheduledAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{container.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {providerName}
                        {providerVerified ? (
                          <ShieldCheck
                            className="size-3.5 text-emerald-600"
                            aria-label="Verified provider"
                          />
                        ) : null}
                      </div>
                      {!providerVerified ? (
                        <div className="text-xs text-muted-foreground">Unverified</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {container.availableM3.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(container.pricePerM3)}
                    </TableCell>
                    <TableCell className="text-right">
                      <BookRow
                        containerId={container.id}
                        max={container.availableM3}
                        disabled={!user || user.role === "provider"}
                        busy={bookingId === container.id}
                        onBook={book}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {user?.role === "provider" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              You are signed in as a provider — providers manage capacity rather than booking it.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function BookRow({
  containerId,
  max,
  disabled,
  busy,
  onBook,
}: {
  containerId: string;
  max: number;
  disabled: boolean;
  busy: boolean;
  onBook: (containerId: string, requestedM3: number) => void;
}) {
  const [value, setValue] = useState(Math.min(1, max).toFixed(1));

  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        className="w-20"
        type="number"
        min="0.1"
        step="0.1"
        max={max}
        aria-label={`Volume to book on ${containerId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        size="sm"
        disabled={disabled || busy}
        onClick={() => {
          const requested = Number(value);
          if (!Number.isFinite(requested) || requested <= 0) {
            toast.error("Enter a volume greater than zero.");
            return;
          }
          if (requested > max) {
            toast.error(`Only ${max.toFixed(2)} m³ is available.`);
            return;
          }
          onBook(containerId, requested);
        }}
      >
        Book
      </Button>
    </div>
  );
}
