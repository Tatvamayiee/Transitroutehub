/**
 * Network map: every lane drawn as a curved arc between its real cities, with the
 * active-shipment layer stacked on top.
 *
 * Leaflet is loaded dynamically inside an effect so it never runs during SSR (its
 * module scope touches `document`). Coordinates come from a bundled table of known
 * hubs; anything else is geocoded through Nominatim (no API key), throttled to its
 * documented one-request-per-second budget and cached for the session.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { BOOKING_STATUS_LABELS, MODE_LABELS } from "@/domain/types";
import type { BookingStatus, RouteMode } from "@/domain/types";

type LeafletModule = typeof import("leaflet");
type MapInstance = import("leaflet").Map;

type LatLng = { lat: number; lng: number };

export type MapLane = {
  id: string;
  origin: string;
  destination: string;
  mode: RouteMode;
  /** Short detail shown in the popup, e.g. "72% utilised · from €74/m³". */
  badge?: string;
};

export type MapShipment = {
  id: string;
  origin: string;
  destination: string;
  mode: RouteMode;
  status: BookingStatus;
  label: string;
};

const MODE_COLORS: Record<RouteMode, string> = {
  sea: "#0284c7",
  road: "#ea580c",
  rail: "#7c3aed",
  air: "#dc2626",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "#64748b",
  confirmed: "#059669",
  in_transit: "#d97706",
  delivered: "#2563eb",
  cancelled: "#9f1239",
};

/** Hubs shipped with the app so the seeded network maps instantly, offline of geocoding. */
const HUBS: Record<string, LatLng> = {
  "mumbai, in": { lat: 19.076, lng: 72.8777 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  "pune, in": { lat: 18.5204, lng: 73.8567 },
  pune: { lat: 18.5204, lng: 73.8567 },
  "chennai, in": { lat: 13.0827, lng: 80.2707 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  "rotterdam, nl": { lat: 51.9244, lng: 4.4777 },
  rotterdam: { lat: 51.9244, lng: 4.4777 },
  "hamburg, de": { lat: 53.5511, lng: 9.9937 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  "dubai, ae": { lat: 25.2048, lng: 55.2708 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  "riyadh, sa": { lat: 24.7136, lng: 46.6753 },
  riyadh: { lat: 24.7136, lng: 46.6753 },
  "jeddah, sa": { lat: 21.4858, lng: 39.1925 },
  "doha, qa": { lat: 25.2854, lng: 51.531 },
  "singapore, sg": { lat: 1.3521, lng: 103.8198 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  "sydney, au": { lat: -33.8688, lng: 151.2093 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  "melbourne, au": { lat: -37.8136, lng: 144.9631 },
  "perth, au": { lat: -31.9505, lng: 115.8605 },
  "tokyo, jp": { lat: 35.6762, lng: 139.6503 },
  "osaka, jp": { lat: 34.6937, lng: 135.5023 },
  "busan, kr": { lat: 35.1796, lng: 129.0756 },
  "shanghai, cn": { lat: 31.2304, lng: 121.4737 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  "shenzhen, cn": { lat: 22.5431, lng: 114.0579 },
  "jakarta, id": { lat: -6.2088, lng: 106.8456 },
  "bangkok, th": { lat: 13.7563, lng: 100.5018 },
  "hochiminh city, vn": { lat: 10.8231, lng: 106.6297 },
  "manila, ph": { lat: 14.5995, lng: 120.9842 },
  "kolkata, in": { lat: 22.5726, lng: 88.3639 },
  "delhi, in": { lat: 28.6139, lng: 77.209 },
  "colombo, lk": { lat: 6.9271, lng: 79.8612 },
  "karachi, pk": { lat: 24.8607, lng: 67.0011 },
  "dhaka, bd": { lat: 23.8103, lng: 90.4125 },
  "antwerp, be": { lat: 51.2194, lng: 4.4025 },
  "havre, fr": { lat: 49.4944, lng: 0.1079 },
  "le havre, fr": { lat: 49.4944, lng: 0.1079 },
  "london, gb": { lat: 51.5072, lng: -0.1276 },
  "felixstowe, gb": { lat: 51.9614, lng: 1.3513 },
  "paris, fr": { lat: 48.8566, lng: 2.3522 },
  "barcelona, es": { lat: 41.3874, lng: 2.1686 },
  "algeciras, es": { lat: 36.1333, lng: -5.4333 },
  "valencia, es": { lat: 39.4699, lng: -0.3763 },
  "genoa, it": { lat: 44.4056, lng: 8.9463 },
  "milan, it": { lat: 45.4642, lng: 9.19 },
  "helsinki, fi": { lat: 60.1699, lng: 24.9384 },
  "istanbul, tr": { lat: 41.0082, lng: 28.9784 },
  "cairo, eg": { lat: 30.0444, lng: 31.2357 },
  "nairobi, ke": { lat: -1.2921, lng: 36.8219 },
  "durban, za": { lat: -29.8587, lng: 31.0218 },
  "johannesburg, za": { lat: -26.2041, lng: 28.0473 },
  "lagos, ng": { lat: 6.5244, lng: 3.3792 },
  "new york, us": { lat: 40.7128, lng: -74.006 },
  "los angeles, us": { lat: 34.0522, lng: -118.2437 },
  "houston, us": { lat: 29.7604, lng: -95.3698 },
  "chicago, us": { lat: 41.8781, lng: -87.6298 },
  "seattle, us": { lat: 47.6062, lng: -122.3321 },
  "miami, us": { lat: 25.7617, lng: -80.1918 },
  "panama city, pa": { lat: 8.9824, lng: -79.5199 },
  "vancouver, ca": { lat: 49.2827, lng: -123.1207 },
  "montreal, ca": { lat: 45.5019, lng: -73.5674 },
  "mexico city, mx": { lat: 19.4326, lng: -99.1332 },
  "santos, br": { lat: -23.9608, lng: -46.3336 },
  "rio de janeiro, br": { lat: -22.9068, lng: -43.1729 },
  "buenos ar, ar": { lat: -34.6037, lng: -58.3816 },
  "santiago, cl": { lat: -33.4489, lng: -70.6693 },
  "lima, pe": { lat: -12.0464, lng: -77.0428 },
};

function placeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const geocodeCache = new Map<string, LatLng | null>();
let geocodeQueue: Promise<unknown> = Promise.resolve();
let lastGeocodeAt = 0;

/** Nominatim allows one request per second; serialise and space out every lookup. */
function throttledGeocode(query: string): Promise<LatLng | null> {
  const run = async (): Promise<LatLng | null> => {
    const wait = Math.max(0, lastGeocodeAt + 1100 - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) return null;
      const rows = (await response.json()) as Array<{ lat: string; lon: string }>;
      const first = rows[0];
      if (!first) return null;
      return { lat: Number(first.lat), lng: Number(first.lon) };
    } catch {
      return null;
    }
  };
  const task = geocodeQueue.then(run, run);
  geocodeQueue = task.catch(() => undefined);
  return task;
}

async function resolvePlace(name: string): Promise<LatLng | null> {
  const key = placeKey(name);
  const cached = geocodeCache.get(key);
  if (cached !== undefined) return cached;
  const local = HUBS[key];
  if (local) {
    geocodeCache.set(key, local);
    return local;
  }
  // Try the bare city before falling back to a full "City, CC" lookup.
  const bare = key.split(",")[0]?.trim() ?? key;
  const localBare = HUBS[bare];
  if (localBare) {
    geocodeCache.set(key, localBare);
    return localBare;
  }
  const found = await throttledGeocode(name);
  geocodeCache.set(key, found);
  return found;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Quadratic bezier between two hubs so crossing lanes read as separate curves. */
function arcPoints(from: LatLng, to: LatLng): import("leaflet").LatLngExpression[] {
  const lat1 = from.lat;
  const lng1 = from.lng;
  const lat2 = to.lat;
  const lng2 = to.lng;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const length = Math.hypot(dLat, dLng) || 1;
  // Perpendicular offset, scaled by the great-circle-ish distance.
  const bend = Math.min(14, Math.max(3, length * 0.22));
  const ctrl = {
    lat: (lat1 + lat2) / 2 - (dLng / length) * bend,
    lng: (lng1 + lng2) / 2 + (dLat / length) * bend,
  };
  const points: import("leaflet").LatLngExpression[] = [];
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push([
      mt * mt * lat1 + 2 * mt * t * ctrl.lat + t * t * lat2,
      mt * mt * lng1 + 2 * mt * t * ctrl.lng + t * t * lng2,
    ]);
  }
  return points;
}

function midPoint(from: LatLng, to: LatLng): LatLng {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const length = Math.hypot(dLat, dLng) || 1;
  const bend = Math.min(14, Math.max(3, length * 0.22));
  const ctrlLat = (from.lat + to.lat) / 2 - (dLng / length) * bend;
  const ctrlLng = (from.lng + to.lng) / 2 + (dLat / length) * bend;
  return {
    lat: 0.25 * from.lat + 0.5 * ctrlLat + 0.25 * to.lat,
    lng: 0.25 * from.lng + 0.5 * ctrlLng + 0.25 * to.lng,
  };
}

async function loadLeaflet(): Promise<LeafletModule> {
  const mod = (await import("leaflet")) as LeafletModule & { default?: LeafletModule };
  return mod.default ?? mod;
}

export function NetworkMap({
  lanes,
  shipments = [],
  height = 420,
  className,
}: {
  lanes: MapLane[];
  shipments?: MapShipment[];
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const laneGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const shipmentGroupRef = useRef<import("leaflet").FeatureGroup | null>(null);
  const lastFitRef = useRef<string>("");

  const [showLanes, setShowLanes] = useState(true);
  const [showShipments, setShowShipments] = useState(true);
  const [geocodeTick, setGeocodeTick] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [unresolved, setUnresolved] = useState<string[]>([]);

  const placeNames = useMemo(() => {
    const names = new Set<string>();
    for (const lane of lanes) {
      names.add(lane.origin);
      names.add(lane.destination);
    }
    for (const shipment of shipments) {
      names.add(shipment.origin);
      names.add(shipment.destination);
    }
    return [...names];
  }, [lanes, shipments]);
  const placesKey = placeNames.join("|");

  // ---- geocode everything we have not seen yet ----
  useEffect(() => {
    let cancelled = false;
    const names = placesKey ? placesKey.split("|") : [];
    const report = () => {
      const missing = names.filter((name) => geocodeCache.get(placeKey(name)) == null);
      setUnresolved((prev) => (prev.join("|") === missing.join("|") ? prev : missing));
      setGeocodeTick((tick) => tick + 1);
    };
    const unknown = names.filter((name) => !geocodeCache.has(placeKey(name)));
    if (unknown.length === 0) {
      report();
      return;
    }
    void Promise.all(unknown.map((name) => resolvePlace(name).catch(() => null))).then(() => {
      if (!cancelled) report();
    });
    return () => {
      cancelled = true;
    };
  }, [placesKey]);

  // ---- create the map once ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    let disposed = false;
    let disconnectObserver: () => void = () => {};

    void loadLeaflet().then((L) => {
      if (disposed || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
        // SVG renderer: paths are real DOM nodes, so they render synchronously and
        // `className` on a polyline works (Leaflet ignores it on canvas). The canvas
        // renderer also drops repaints when a resize lands during the fitBounds zoom
        // animation, which left this map blank intermittently.
      });
      // CARTO's basemap CDN now serves a watermarked "API key required" placeholder to
      // unkeyed clients, so use the keyless OSM raster tiles instead.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        // OSM asks clients to identify themselves; Leaflet sends no custom UA from a
        // browser, so the referrer policy is left at its default and traffic stays low.
      }).addTo(map);
      map.setView([20, 10], 2);
      mapRef.current = map;
      const lanesLayer = L.featureGroup();
      lanesLayer.addTo(map);
      laneGroupRef.current = lanesLayer;
      const shipsLayer = L.featureGroup();
      shipsLayer.addTo(map);
      shipmentGroupRef.current = shipsLayer;

      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(host);
      map.invalidateSize();
      disconnectObserver = () => observer.disconnect();
      // Geocoding can resolve before the chunk finishes loading; redraw once ready.
      setMapReady(true);
    });

    return () => {
      disposed = true;
      disconnectObserver();
      mapRef.current?.remove();
      mapRef.current = null;
      laneGroupRef.current = null;
      shipmentGroupRef.current = null;
    };
  }, []);

  // ---- draw layers whenever data, geocoding or toggles change ----
  useEffect(() => {
    if (!mapReady || !mapRef.current || !laneGroupRef.current || !shipmentGroupRef.current) {
      return;
    }
    void loadLeaflet().then((lib) => {
      const map = mapRef.current;
      const laneLayer = laneGroupRef.current;
      const shipLayer = shipmentGroupRef.current;
      if (!map || !laneLayer || !shipLayer) return;

      laneLayer.clearLayers();
      shipLayer.clearLayers();

      const bounds: import("leaflet").LatLngTuple[] = [];
      const hubTraffic = new Map<string, number>();

      const placeOf = (name: string) => geocodeCache.get(placeKey(name)) ?? null;

      if (showLanes) {
        for (const lane of lanes) {
          const from = placeOf(lane.origin);
          const to = placeOf(lane.destination);
          if (!from || !to) continue;
          bounds.push([from.lat, from.lng], [to.lat, to.lng]);
          hubTraffic.set(lane.origin, (hubTraffic.get(lane.origin) ?? 0) + 1);
          hubTraffic.set(lane.destination, (hubTraffic.get(lane.destination) ?? 0) + 1);

          const color = MODE_COLORS[lane.mode];
          lib
            .polyline(arcPoints(from, to), {
              color,
              weight: 3,
              opacity: 0.75,
              className: "trh-lane-arc",
            })
            .bindPopup(
              `<b>${escapeHtml(lane.origin)} → ${escapeHtml(lane.destination)}</b><br>` +
                `${MODE_LABELS[lane.mode]}` +
                (lane.badge ? `<br>${escapeHtml(lane.badge)}` : ""),
            )
            .addTo(laneLayer);
        }
      }

      if (showShipments && shipments.length > 0) {
        for (const shipment of shipments) {
          const from = placeOf(shipment.origin);
          const to = placeOf(shipment.destination);
          if (!from || !to) continue;
          const color = STATUS_COLORS[shipment.status];
          lib
            .polyline(arcPoints(from, to), {
              color,
              weight: 6,
              opacity: 0.55,
              className: "trh-shipment-arc",
              ...(shipment.status === "pending" ? { dashArray: "1 7" } : {}),
            })
            .bindPopup(
              `<b>${escapeHtml(shipment.label)}</b><br>` +
                `${escapeHtml(shipment.origin)} → ${escapeHtml(shipment.destination)}<br>` +
                `${BOOKING_STATUS_LABELS[shipment.status]} · ${MODE_LABELS[shipment.mode]}`,
            )
            .addTo(shipLayer);
          const marker = lib.circleMarker(midPoint(from, to), {
            radius: 5,
            color: "#ffffff",
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
          });
          marker.bindPopup(
            `<b>${escapeHtml(shipment.label)}</b><br>` +
              `${escapeHtml(shipment.origin)} → ${escapeHtml(shipment.destination)}<br>` +
              `${BOOKING_STATUS_LABELS[shipment.status]} · ${MODE_LABELS[shipment.mode]}`,
          );
          marker.bindTooltip(BOOKING_STATUS_LABELS[shipment.status], { direction: "top" });
          marker.addTo(shipLayer);
        }
      }

      if (showLanes && lanes.length > 0 && bounds.length > 0) {
        for (const [name, count] of hubTraffic) {
          const point = placeOf(name);
          if (!point) continue;
          const circle = lib.circleMarker([point.lat, point.lng], {
            radius: Math.min(9, 5 + count),
            color: "#0f172a",
            weight: 1.5,
            fillColor: "#ffffff",
            fillOpacity: 0.95,
          });
          circle.bindTooltip(`${name} · ${count} lane${count === 1 ? "" : "s"}`, {
            direction: "top",
          });
          circle.addTo(laneLayer);
        }
      }

      const fitKey = showLanes ? placesKey : "shipments";
      if (bounds.length > 0 && fitKey !== lastFitRef.current) {
        lastFitRef.current = fitKey;
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      }
    });
    // `geocodeTick` re-runs the draw after coordinates arrive; `mapReady` after the chunk loads.
  }, [mapReady, lanes, shipments, showLanes, showShipments, placesKey, geocodeTick]);

  const activeModes = useMemo(() => {
    const present = new Set(lanes.map((lane) => lane.mode));
    return (["road", "rail", "sea", "air"] as RouteMode[]).filter((mode) => present.has(mode));
  }, [lanes]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {activeModes.map((mode) => (
            <span key={mode} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-1 w-6 rounded-full"
                style={{ backgroundColor: MODE_COLORS[mode] }}
              />
              {MODE_LABELS[mode]}
            </span>
          ))}
          {showShipments && shipments.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1 w-6 rounded-full bg-amber-600" />
              Active shipment
            </span>
          ) : null}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-pressed={showLanes}
            onClick={() => setShowLanes((value) => !value)}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              showLanes
                ? "border-primary/50 bg-secondary text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-secondary"
            }`}
          >
            Lanes
          </button>
          {shipments.length > 0 ? (
            <button
              type="button"
              aria-pressed={showShipments}
              onClick={() => setShowShipments((value) => !value)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                showShipments
                  ? "border-primary/50 bg-secondary text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              Shipments
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={hostRef}
        style={{ height }}
        className="trh-map relative z-0 mt-3 overflow-hidden rounded-lg border border-border/60 bg-secondary"
        role="application"
        aria-label="Network map of lanes and active shipments"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {lanes.length} lane{lanes.length === 1 ? "" : "s"}
          {shipments.length > 0
            ? ` · ${shipments.length} active shipment${shipments.length === 1 ? "" : "s"}`
            : ""}
        </span>
        {unresolved.length > 0 ? (
          <span className="text-amber-600 dark:text-amber-400">
            No coordinates for: {unresolved.join(", ")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
