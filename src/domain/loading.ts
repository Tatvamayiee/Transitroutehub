/**
 * 3D container loading domain model.
 *
 * Pure functions only — no React, no store access — so the packing solver can be
 * unit-tested and reused on both the server (authoritative placement) and the client
 * (live drag preview feedback).
 *
 * Coordinate system, in centimetres:
 *   x → along the container length (0 = nose / front wall, length = doors)
 *   z → across the container width
 *   y → up from the floor
 *
 * Cargo is packed from the nose so a part load never blocks the doors.
 * Every box is axis aligned; `rotated` swaps its length and width (90° yaw).
 */

import type { RouteMode } from "@/domain/types";

// ---------------- container specs ----------------

export type ContainerKind = "20ft" | "40ft" | "40ft-hc" | "trailer" | "air-pallet";

export type ContainerSpec = {
  kind: ContainerKind;
  name: string;
  /** Internal length, cm (x). */
  lengthCm: number;
  /** Internal width, cm (z). */
  widthCm: number;
  /** Internal height, cm (y). */
  heightCm: number;
  /** Maximum cargo weight, kg. */
  maxPayloadKg: number;
};

export const CONTAINER_SPECS: Record<ContainerKind, ContainerSpec> = {
  "20ft": {
    kind: "20ft",
    name: "20 ft dry container",
    lengthCm: 589,
    widthCm: 235,
    heightCm: 239,
    maxPayloadKg: 28_200,
  },
  "40ft": {
    kind: "40ft",
    name: "40 ft dry container",
    lengthCm: 1203,
    widthCm: 235,
    heightCm: 239,
    maxPayloadKg: 26_700,
  },
  "40ft-hc": {
    kind: "40ft-hc",
    name: "40 ft high-cube container",
    lengthCm: 1203,
    widthCm: 235,
    heightCm: 269,
    maxPayloadKg: 26_500,
  },
  trailer: {
    kind: "trailer",
    name: "Curtain-side trailer",
    lengthCm: 1360,
    widthCm: 245,
    heightCm: 270,
    maxPayloadKg: 24_000,
  },
  "air-pallet": {
    kind: "air-pallet",
    name: "Main-deck air pallet (PMC)",
    lengthCm: 318,
    widthCm: 244,
    heightCm: 300,
    maxPayloadKg: 6_800,
  },
};

export function specVolumeM3(spec: ContainerSpec): number {
  return (spec.lengthCm * spec.widthCm * spec.heightCm) / 1_000_000;
}

/**
 * Picks the smallest equipment type that can hold the capacity a provider listed,
 * shaped by the transport mode. Listed capacity is a commercial share of the box, so
 * the physical container is always at least that large.
 */
export function specForContainer(mode: RouteMode, capacityM3: number): ContainerSpec {
  if (mode === "air") return CONTAINER_SPECS["air-pallet"];
  if (mode === "road") return CONTAINER_SPECS.trailer;
  if (capacityM3 <= specVolumeM3(CONTAINER_SPECS["20ft"])) return CONTAINER_SPECS["20ft"];
  if (capacityM3 <= specVolumeM3(CONTAINER_SPECS["40ft"])) return CONTAINER_SPECS["40ft"];
  return CONTAINER_SPECS["40ft-hc"];
}

// ---------------- cargo ----------------

export type Placement = {
  xCm: number;
  yCm: number;
  zCm: number;
  rotated: boolean;
};

export type CargoBox = {
  id: string;
  bookingId: string;
  label: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  fragile: boolean;
  /** 0..5, selects a palette colour in the 3D scene. */
  hue: number;
  placement: Placement | null;
};

export function boxVolumeM3(box: { lengthCm: number; widthCm: number; heightCm: number }): number {
  return (box.lengthCm * box.widthCm * box.heightCm) / 1_000_000;
}

/** Footprint extents of a box after applying its stored rotation. */
export function footprint(box: CargoBox): { l: number; w: number } {
  const rotated = box.placement?.rotated ?? false;
  return rotated ? { l: box.widthCm, w: box.lengthCm } : { l: box.lengthCm, w: box.widthCm };
}

export type BoxBounds = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
};

export function placedBounds(box: CargoBox): BoxBounds | null {
  if (!box.placement) return null;
  const { l, w } = footprint(box);
  const { xCm, yCm, zCm } = box.placement;
  return { x0: xCm, x1: xCm + l, y0: yCm, y1: yCm + box.heightCm, z0: zCm, z1: zCm + w };
}

/** Touching faces are allowed; only a real overlap conflicts. */
export function boundsOverlap(a: BoxBounds, b: BoxBounds, epsilon = 0.01): boolean {
  return (
    a.x0 < b.x1 - epsilon &&
    b.x0 < a.x1 - epsilon &&
    a.y0 < b.y1 - epsilon &&
    b.y0 < a.y1 - epsilon &&
    a.z0 < b.z1 - epsilon &&
    b.z0 < a.z1 - epsilon
  );
}

export type PlacementCheck = { ok: true } | { ok: false; reason: string };

type Dimensions = { lengthCm: number; widthCm: number; heightCm: number };

/**
 * Geometry check used by both the solver and manual moves: tests the given dimensions
 * at the given placement, ignoring `excludeId` (the package being moved, if it is
 * already in the list).
 */
export function checkSpace(
  spec: ContainerSpec,
  boxes: readonly CargoBox[],
  dims: Dimensions,
  placement: Placement,
  excludeId: string | null,
): PlacementCheck {
  const { l, w } = placement.rotated
    ? { l: dims.widthCm, w: dims.lengthCm }
    : { l: dims.lengthCm, w: dims.widthCm };

  if (placement.xCm < 0 || placement.yCm < 0 || placement.zCm < 0) {
    return { ok: false, reason: "A package cannot sit outside the container." };
  }
  if (placement.xCm + l > spec.lengthCm + 0.01) {
    return { ok: false, reason: `That would poke through the ${spec.lengthCm} cm end wall.` };
  }
  if (placement.zCm + w > spec.widthCm + 0.01) {
    return { ok: false, reason: `That would poke through the ${spec.widthCm} cm side wall.` };
  }
  if (placement.yCm + dims.heightCm > spec.heightCm + 0.01) {
    return { ok: false, reason: `That would poke through the ${spec.heightCm} cm roof.` };
  }

  const candidate: BoxBounds = {
    x0: placement.xCm,
    x1: placement.xCm + l,
    y0: placement.yCm,
    y1: placement.yCm + dims.heightCm,
    z0: placement.zCm,
    z1: placement.zCm + w,
  };
  for (const other of boxes) {
    if (other.id === excludeId) continue;
    const bounds = placedBounds(other);
    if (!bounds) continue;
    if (boundsOverlap(candidate, bounds)) {
      return { ok: false, reason: `That space is already taken by ${other.label}.` };
    }
  }
  return { ok: true };
}

/** Validates a placement for a package that already exists in the plan. */
export function checkPlacement(
  spec: ContainerSpec,
  boxes: readonly CargoBox[],
  boxId: string,
  placement: Placement,
): PlacementCheck {
  const box = boxes.find((row) => row.id === boxId);
  if (!box) return { ok: false, reason: "That package no longer exists." };
  return checkSpace(spec, boxes, box, placement, boxId);
}

/**
 * Resolves vertical stacking: when the requested placement intersects other cargo
 * (raising a box on the same footprint, dropping it onto a filled patch of floor,
 * rotating into a neighbour), lift it to the first clear height at or above the
 * requested one so it rests on top of whatever is in the way. Returns `null` when
 * no clear height exists below the roof, and the caller should let the server
 * reject with its precise reason.
 */
export function firstClearY(
  spec: ContainerSpec,
  boxes: readonly CargoBox[],
  boxId: string,
  placement: Placement,
): number | null {
  const box = boxes.find((row) => row.id === boxId);
  if (!box) return null;
  const start = Math.max(0, Math.ceil(placement.yCm));
  const ceiling = spec.heightCm - box.heightCm;
  for (let y = start; y <= ceiling; y += 1) {
    if (checkPlacement(spec, boxes, boxId, { ...placement, yCm: y }).ok) return y;
  }
  return null;
}

// ---------------- packing solver ----------------

type Space = { x: number; y: number; z: number; l: number; w: number; h: number };

const MAX_SPACES = 600;

/**
 * Deterministic 3D bin packing ("lowest, then nearest the doors").
 *
 * Free space is tracked as a list of boxes. Each package is dropped into the
 * candidate space with the smallest height, so it always rests on the floor or on top
 * of an already placed package, then that space is guillotine-split into the three
 * remainders (beyond it in x, in z, and above it).
 *
 * Returns null for packages that cannot be loaded.
 */
export function packBoxes(spec: ContainerSpec, boxes: readonly CargoBox[]): Map<string, Placement> {
  const spaces: Space[] = [
    { x: 0, y: 0, z: 0, l: spec.lengthCm, w: spec.widthCm, h: spec.heightCm },
  ];
  const placed = new Map<string, Placement>();

  // Tallest and bulkiest first: that is what produces stable stacks.
  const order = [...boxes].sort(
    (a, b) =>
      b.heightCm - a.heightCm || boxVolumeM3(b) - boxVolumeM3(a) || a.label.localeCompare(b.label),
  );

  for (const box of order) {
    let best: { space: Space; rotated: boolean; score: number } | null = null;

    for (let i = 0; i < spaces.length; i += 1) {
      const space = spaces[i];
      if (!space) continue;
      for (const rotated of [false, true]) {
        const l = rotated ? box.widthCm : box.lengthCm;
        const w = rotated ? box.lengthCm : box.widthCm;
        if (l > space.l + 0.01 || w > space.w + 0.01 || box.heightCm > space.h + 0.01) continue;
        // Prefer low, then close to the doors, then the tightest leftover.
        const score = space.y * 1_000_000 + (space.x + space.z) * 100 + space.l * space.w;
        if (!best || score < best.score) best = { space, rotated, score };
      }
    }

    if (!best) continue;

    const { space, rotated } = best;
    const l = rotated ? box.widthCm : box.lengthCm;
    const w = rotated ? box.lengthCm : box.widthCm;
    placed.set(box.id, { xCm: space.x, yCm: space.y, zCm: space.z, rotated });

    const index = spaces.indexOf(space);
    const next: Space[] = [];
    if (space.l - l > 0.01) {
      next.push({ x: space.x + l, y: space.y, z: space.z, l: space.l - l, w: space.w, h: space.h });
    }
    if (space.w - w > 0.01) {
      next.push({ x: space.x, y: space.y, z: space.z + w, l, w: space.w - w, h: space.h });
    }
    if (space.h - box.heightCm > 0.01) {
      next.push({
        x: space.x,
        y: space.y + box.heightCm,
        z: space.z,
        l,
        w,
        h: space.h - box.heightCm,
      });
    }
    spaces.splice(index, 1, ...next);
    if (spaces.length > MAX_SPACES) {
      spaces.sort((a, b) => b.l * b.w * b.h - a.l * a.w * a.h);
      spaces.length = MAX_SPACES;
    }
  }

  return placed;
}

/** Candidate drop positions for one package around already placed cargo. */
export function findDropSlot(
  spec: ContainerSpec,
  boxes: readonly CargoBox[],
  box: CargoBox,
): Placement | null {
  const candidates: Array<{ x: number; z: number; y: number }> = [{ x: 0, y: 0, z: 0 }];
  for (const other of boxes) {
    if (other.id === box.id) continue;
    const bounds = placedBounds(other);
    if (!bounds) continue;
    candidates.push(
      { x: bounds.x1, y: bounds.y0, z: bounds.z0 },
      { x: bounds.x0, y: bounds.y0, z: bounds.z1 },
      { x: bounds.x0, y: bounds.y1, z: bounds.z0 },
    );
  }

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: candidate.y * 1_000_000 + (candidate.x + candidate.z) * 100,
    }))
    .sort((a, b) => a.score - b.score);

  for (const candidate of ranked) {
    for (const rotated of [false, true]) {
      const placement = { xCm: candidate.x, yCm: candidate.y, zCm: candidate.z, rotated };
      if (checkSpace(spec, boxes, box, placement, box.id).ok) return placement;
    }
  }
  return null;
}

// ---------------- load statistics ----------------

export type LoadStats = {
  totalVolumeM3: number;
  bookedVolumeM3: number;
  placedVolumeM3: number;
  unplacedVolumeM3: number;
  fillOfBookedPct: number;
  fillOfContainerPct: number;
  totalWeightKg: number;
  payloadPct: number;
  floorAreaUsedM2: number;
  floorAreaM2: number;
  maxHeightCm: number;
  /** Centre of gravity, as a fraction of length and width from the origin. */
  centreOfGravity: { xPct: number; zPct: number; heightCm: number };
  placedCount: number;
  unplacedCount: number;
  /** Stacking order violations: cargo resting on a fragile package. */
  fragileOverloads: string[];
  warnings: string[];
};

export function computeLoadStats(
  spec: ContainerSpec,
  boxes: readonly CargoBox[],
  bookedVolumeM3: number,
): LoadStats {
  const placedBoxes = boxes.filter((box) => box.placement !== null);
  const unplaced = boxes.filter((box) => box.placement === null);

  const placedVolumeM3 = placedBoxes.reduce((sum, box) => sum + boxVolumeM3(box), 0);
  const unplacedVolumeM3 = unplaced.reduce((sum, box) => sum + boxVolumeM3(box), 0);
  const totalWeightKg = placedBoxes.reduce((sum, box) => sum + box.weightKg, 0);
  const capacity = specVolumeM3(spec);

  let weightedX = 0;
  let weightedZ = 0;
  let weightedY = 0;
  let weightTotal = 0;
  let maxHeightCm = 0;
  const floorCells = new Set<string>();

  for (const box of placedBoxes) {
    const bounds = placedBounds(box);
    if (!bounds) continue;
    const mass = box.weightKg > 0 ? box.weightKg : boxVolumeM3(box) * 200;
    weightedX += ((bounds.x0 + bounds.x1) / 2) * mass;
    weightedZ += ((bounds.z0 + bounds.z1) / 2) * mass;
    weightedY += ((bounds.y0 + bounds.y1) / 2) * mass;
    weightTotal += mass;
    maxHeightCm = Math.max(maxHeightCm, bounds.y1);
    // 25 cm grid, so the floor-area figure is a real footprint union, not a sum.
    for (let x = bounds.x0; x < bounds.x1; x += 25) {
      for (let z = bounds.z0; z < bounds.z1; z += 25) {
        floorCells.add(`${Math.floor(x / 25)}:${Math.floor(z / 25)}`);
      }
    }
  }

  const fragileOverloads: string[] = [];
  for (const fragile of placedBoxes) {
    if (!fragile.fragile) continue;
    const bounds = placedBounds(fragile);
    if (!bounds) continue;
    const crushed = placedBoxes.some((other) => {
      if (other.id === fragile.id) return false;
      const otherBounds = placedBounds(other);
      if (!otherBounds) return false;
      return (
        Math.abs(otherBounds.y0 - bounds.y1) < 0.5 &&
        otherBounds.x0 < bounds.x1 - 0.01 &&
        bounds.x0 < otherBounds.x1 - 0.01 &&
        otherBounds.z0 < bounds.z1 - 0.01 &&
        bounds.z0 < otherBounds.z1 - 0.01
      );
    });
    if (crushed) fragileOverloads.push(fragile.label);
  }

  const warnings: string[] = [];
  if (unplaced.length > 0) {
    warnings.push(
      `${unplaced.length} package${unplaced.length === 1 ? "" : "s"} (${unplacedVolumeM3.toFixed(2)} m³) could not be loaded — they do not fit in the remaining space.`,
    );
  }
  if (totalWeightKg > spec.maxPayloadKg) {
    warnings.push(
      `Cargo weighs ${Math.round(totalWeightKg).toLocaleString()} kg against a ${spec.maxPayloadKg.toLocaleString()} kg payload limit.`,
    );
  }
  if (fragileOverloads.length > 0) {
    warnings.push(`Fragile cargo is being stacked on: ${fragileOverloads.join(", ")}.`);
  }
  const xPct = weightTotal > 0 ? (weightedX / weightTotal / spec.lengthCm) * 100 : 0;
  const containerFillPct =
    capacity > 0 ? ((placedVolumeM3 + unplacedVolumeM3) / capacity) * 100 : 0;
  // Balance only matters once there is enough cargo to shift the axles.
  if (weightTotal > 0 && containerFillPct >= 45 && Math.abs(xPct - 50) > 12) {
    warnings.push(
      `Load is unbalanced: ${xPct.toFixed(0)}% of the weight sits ${xPct > 50 ? "aft" : "forward"}. Spread cargo toward the ${xPct > 50 ? "doors" : "nose"} to avoid axle overload.`,
    );
  }

  return {
    totalVolumeM3: placedVolumeM3 + unplacedVolumeM3,
    bookedVolumeM3,
    placedVolumeM3,
    unplacedVolumeM3,
    fillOfBookedPct:
      bookedVolumeM3 > 0 ? Math.min(999, (placedVolumeM3 / bookedVolumeM3) * 100) : 0,
    fillOfContainerPct: capacity > 0 ? (placedVolumeM3 / capacity) * 100 : 0,
    totalWeightKg,
    payloadPct: spec.maxPayloadKg > 0 ? (totalWeightKg / spec.maxPayloadKg) * 100 : 0,
    floorAreaUsedM2: (floorCells.size * 25 * 25) / 10_000,
    floorAreaM2: (spec.lengthCm * spec.widthCm) / 10_000,
    maxHeightCm,
    centreOfGravity: {
      xPct,
      zPct: weightTotal > 0 ? (weightedZ / weightTotal / spec.widthCm) * 100 : 0,
      heightCm: weightTotal > 0 ? weightedY / weightTotal : 0,
    },
    placedCount: placedBoxes.length,
    unplacedCount: unplaced.length,
    fragileOverloads,
    warnings,
  };
}

// ---------------- demo cargo generation ----------------

type GeneratedShape = {
  label: string;
  lengthCm: number;
  widthCm: number;
  densityKgM3: number;
};

const DEFAULT_SHAPE: GeneratedShape = {
  label: "EUR pallet",
  lengthCm: 120,
  widthCm: 100,
  densityKgM3: 240,
};

const GENERATED_SHAPES: GeneratedShape[] = [
  DEFAULT_SHAPE,
  { label: "Industrial crate", lengthCm: 100, widthCm: 80, densityKgM3: 310 },
  { label: "Carton stack", lengthCm: 80, widthCm: 60, densityKgM3: 160 },
];

/**
 * Builds a realistic pallet list from the volume a trader already booked, so the page
 * has something meaningful to show before anyone enters dimensions by hand.
 */
export function generateCargoFromVolume(
  bookingId: string,
  bookedM3: number,
  spec: ContainerSpec,
  nextId: () => string,
): CargoBox[] {
  const usable = Math.max(0.2, Math.min(bookedM3, specVolumeM3(spec)));
  const count = Math.max(1, Math.min(24, Math.round(usable / 2)));
  const perBox = usable / count;

  const heightFor = (shape: GeneratedShape) =>
    Math.round((perBox / ((shape.lengthCm * shape.widthCm) / 10_000)) * 100);

  return Array.from({ length: count }, (_, index) => {
    const preferred = GENERATED_SHAPES[index % GENERATED_SHAPES.length] ?? DEFAULT_SHAPE;
    // Only vary the footprint when that shape's stack still fits under the roof;
    // otherwise every package would be silently truncated and the plan would
    // under-report the booked volume.
    const shape = heightFor(preferred) <= spec.heightCm * 0.94 ? preferred : DEFAULT_SHAPE;
    const height = Math.min(spec.heightCm, Math.max(40, heightFor(shape)));
    const volume = (shape.lengthCm * shape.widthCm * height) / 1_000_000;
    return {
      id: nextId(),
      bookingId,
      label: `${shape.label} ${String(index + 1).padStart(2, "0")}`,
      lengthCm: shape.lengthCm,
      widthCm: shape.widthCm,
      heightCm: height,
      weightKg: Math.round(volume * shape.densityKgM3),
      fragile: index % 5 === 4,
      hue: index % 6,
      placement: null,
    } satisfies CargoBox;
  });
}
