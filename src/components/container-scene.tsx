/**
 * Interactive 3D container viewer.
 *
 * Deliberately dependency-free: a small perspective projector on a 2D canvas. That
 * keeps the client bundle lean and gives exact control over depth sorting, hit testing
 * and drag projection — which is what makes pulling a package out of a stack work.
 *
 * World space is centimetres, y up, origin at the door-end floor corner.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CargoBox, ContainerSpec, Placement } from "@/domain/loading";

type Vec3 = { x: number; y: number; z: number };
type Point2 = { x: number; y: number };

type Camera = {
  yaw: number;
  pitch: number;
  zoom: number;
};

type View = {
  eye: Vec3;
  forward: Vec3;
  project: (point: Vec3) => Point2;
  depthOf: (point: Vec3) => number;
};

export type ViewPreset = "iso" | "top" | "side" | "doors";

const PRESETS: Record<ViewPreset, Pick<Camera, "yaw" | "pitch">> = {
  iso: { yaw: 0.7, pitch: 0.4 },
  top: { yaw: 0.0001, pitch: 1.44 },
  side: { yaw: 1.5708, pitch: 0.12 },
  doors: { yaw: 0, pitch: 0.2 },
};

const DEFAULT_SWATCH = { h: 199, s: 58, l: 50 };

const PALETTE = [
  DEFAULT_SWATCH,
  { h: 168, s: 42, l: 46 },
  { h: 36, s: 66, l: 54 },
  { h: 262, s: 38, l: 58 },
  { h: 6, s: 55, l: 56 },
  { h: 118, s: 28, l: 46 },
];

const LIGHT: Vec3 = { x: 0.38, y: 0.82, z: 0.42 };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function norm(a: Vec3): Vec3 {
  const length = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / length, y: a.y / length, z: a.z / length };
}

/** Camera that frames the container on screen at the current rotation, then zooms. */
function buildView(spec: ContainerSpec, camera: Camera, width: number, height: number): View {
  const target: Vec3 = { x: spec.lengthCm / 2, y: spec.heightCm * 0.42, z: spec.widthCm / 2 };
  const diagonal = Math.hypot(spec.lengthCm, spec.widthCm, spec.heightCm);
  const dist = diagonal * 1.6;
  const eye: Vec3 = {
    x: target.x + dist * Math.cos(camera.pitch) * Math.sin(camera.yaw),
    y: target.y + dist * Math.sin(camera.pitch),
    z: target.z + dist * Math.cos(camera.pitch) * Math.cos(camera.yaw),
  };
  const forward = norm(sub(target, eye));
  const right = norm(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);

  const corners: Vec3[] = [];
  for (const x of [0, spec.lengthCm]) {
    for (const y of [0, spec.heightCm]) {
      for (const z of [0, spec.widthCm]) corners.push({ x, y, z });
    }
  }

  const unit = (point: Vec3): Point2 => {
    const d = sub(point, eye);
    const depth = Math.max(1, dot(d, forward));
    return { x: dot(d, right) / depth, y: dot(d, up) / depth };
  };

  const raw = corners.map(unit);
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const fit = 0.84 * Math.min(width / (spanX || 1), height / (spanY || 1));
  const focal = fit * camera.zoom;
  const midX = ((Math.max(...xs) + Math.min(...xs)) / 2) * focal;
  const midY = ((Math.max(...ys) + Math.min(...ys)) / 2) * focal;

  return {
    eye,
    forward,
    project: (point) => {
      const projected = unit(point);
      return {
        x: width / 2 - midX + projected.x * focal,
        y: height / 2 + midY - projected.y * focal,
      };
    },
    depthOf: (point) => dot(sub(point, eye), forward),
  };
}

type Face = {
  points: Point2[];
  depth: number;
  fill: string;
  stroke: string;
  lineWidth: number;
  boxId: string;
  label: string | null;
  fragile: boolean;
};

function boxFaces(box: CargoBox, view: View, selected: boolean, hovered: boolean): Face[] {
  const placement = box.placement;
  if (!placement) return [];
  const l = placement.rotated ? box.widthCm : box.lengthCm;
  const w = placement.rotated ? box.lengthCm : box.widthCm;
  const { xCm: x, yCm: y, zCm: z } = placement;
  const h = box.heightCm;

  const A: Vec3 = { x, y, z };
  const B: Vec3 = { x: x + l, y, z };
  const C: Vec3 = { x: x + l, y, z: z + w };
  const D: Vec3 = { x, y, z: z + w };
  const E: Vec3 = { x, y: y + h, z };
  const F: Vec3 = { x: x + l, y: y + h, z };
  const G: Vec3 = { x: x + l, y: y + h, z: z + w };
  const H: Vec3 = { x, y: y + h, z: z + w };

  const palette = PALETTE[box.hue % PALETTE.length] ?? DEFAULT_SWATCH;
  const specs: Array<{ pts: Vec3[]; n: Vec3; top?: boolean }> = [
    { pts: [E, F, G, H], n: { x: 0, y: 1, z: 0 }, top: true },
    { pts: [A, B, F, E], n: { x: 0, y: 0, z: -1 } },
    { pts: [D, C, G, H], n: { x: 0, y: 0, z: 1 } },
    { pts: [B, C, G, F], n: { x: 1, y: 0, z: 0 } },
    { pts: [A, D, H, E], n: { x: -1, y: 0, z: 0 } },
    { pts: [A, B, C, D], n: { x: 0, y: -1, z: 0 } },
  ];

  const faces: Face[] = [];
  for (const face of specs) {
    const centroid: Vec3 = face.pts.reduce(
      (acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4, z: acc.z + p.z / 4 }),
      { x: 0, y: 0, z: 0 },
    );
    const toEye = sub(view.eye, centroid);
    if (dot(face.n, toEye) <= 0) continue;

    const shade = 0.58 + 0.52 * Math.max(0, dot(norm(face.n), norm(LIGHT)));
    const lightness = Math.max(12, Math.min(80, palette.l * shade));
    const fill = `hsl(${palette.h} ${palette.s}% ${lightness.toFixed(1)}%)`;
    const stroke = selected
      ? "hsl(190 95% 45%)"
      : hovered
        ? "hsl(190 70% 60%)"
        : `hsl(${palette.h} ${Math.min(70, palette.s + 15)}% ${Math.max(10, lightness - 22)}%)`;

    faces.push({
      points: face.pts.map(view.project),
      depth: view.depthOf(centroid),
      fill,
      stroke,
      lineWidth: selected ? 2.4 : hovered ? 1.6 : 1,
      boxId: box.id,
      label: null,
      fragile: Boolean(face.top && box.fragile),
    });
  }
  return faces;
}

function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Convex hull (Andrew monotone chain) of the 8 projected corners: the box silhouette. */
function silhouette(view: View, box: CargoBox): Point2[] {
  const placement = box.placement;
  if (!placement) return [];
  const l = placement.rotated ? box.widthCm : box.lengthCm;
  const w = placement.rotated ? box.lengthCm : box.widthCm;
  const points: Point2[] = [];
  for (const dx of [0, l]) {
    for (const dy of [0, box.heightCm]) {
      for (const dz of [0, w]) {
        points.push(
          view.project({
            x: placement.xCm + dx,
            y: placement.yCm + dy,
            z: placement.zCm + dz,
          }),
        );
      }
    }
  }
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point2[] = [];
  for (const p of points) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2];
      const b = lower[lower.length - 1];
      if (!a || !b || cross2(a, b, p) > 0) break;
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point2[] = [];
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = points[i];
    if (!p) continue;
    while (upper.length >= 2) {
      const a = upper[upper.length - 2];
      const b = upper[upper.length - 1];
      if (!a || !b || cross2(a, b, p) > 0) break;
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross2(o: Point2, a: Point2, b: Point2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function tracePath(ctx: CanvasRenderingContext2D, points: Point2[]): boolean {
  const first = points[0];
  if (!first) return false;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  return true;
}

export function ContainerScene({
  spec,
  boxes,
  selectedId,
  onSelect,
  onMove,
  viewPreset,
  height = 460,
  className,
}: {
  spec: ContainerSpec;
  boxes: CargoBox[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, placement: Placement) => void;
  viewPreset?: { preset: ViewPreset; nonce: number };
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<Camera>({ yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch, zoom: 1 });
  const viewRef = useRef<View | null>(null);
  const dragRef = useRef<{
    id: string;
    start: Placement;
    pointer: Point2;
    moved: boolean;
    next: Placement | null;
  } | null>(null);
  const orbitRef = useRef<{ yaw: number; pitch: number; pointer: Point2 } | null>(null);

  const [size, setSize] = useState({ width: 0, height });
  const [hovered, setHovered] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; placement: Placement } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Re-frame when the parent asks for a different preset.
  useEffect(() => {
    if (!viewPreset) return;
    cameraRef.current = { ...PRESETS[viewPreset.preset], zoom: cameraRef.current.zoom };
  }, [viewPreset]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height });
    return () => observer.disconnect();
  }, [height]);

  const renderBoxes = boxes.map((box) =>
    draft && draft.id === box.id ? { ...box, placement: draft.placement } : box,
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, height);

    const view = buildView(spec, cameraRef.current, size.width, height);
    viewRef.current = view;

    // Floor plate
    const floor: Point2[] = [
      view.project({ x: 0, y: 0, z: 0 }),
      view.project({ x: spec.lengthCm, y: 0, z: 0 }),
      view.project({ x: spec.lengthCm, y: 0, z: spec.widthCm }),
      view.project({ x: 0, y: 0, z: spec.widthCm }),
    ];
    if (tracePath(ctx, floor)) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.16)";
      ctx.fill();
    }

    // 1 m floor grid
    ctx.strokeStyle = "rgba(100, 116, 139, 0.28)";
    ctx.lineWidth = 0.7;
    for (let x = 100; x < spec.lengthCm; x += 100) {
      const a = view.project({ x, y: 0, z: 0 });
      const b = view.project({ x, y: 0, z: spec.widthCm });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let z = 100; z < spec.widthCm; z += 100) {
      const a = view.project({ x: 0, y: 0, z });
      const b = view.project({ x: spec.lengthCm, y: 0, z });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Container shell: the twelve edges.
    const corner = (x: number, y: number, z: number) => view.project({ x, y, z });
    const L = spec.lengthCm;
    const W = spec.widthCm;
    const H = spec.heightCm;
    const edges: Array<[Point2, Point2]> = [
      [corner(0, 0, 0), corner(L, 0, 0)],
      [corner(L, 0, 0), corner(L, 0, W)],
      [corner(L, 0, W), corner(0, 0, W)],
      [corner(0, 0, W), corner(0, 0, 0)],
      [corner(0, H, 0), corner(L, H, 0)],
      [corner(L, H, 0), corner(L, H, W)],
      [corner(L, H, W), corner(0, H, W)],
      [corner(0, H, W), corner(0, H, 0)],
      [corner(0, 0, 0), corner(0, H, 0)],
      [corner(L, 0, 0), corner(L, H, 0)],
      [corner(L, 0, W), corner(L, H, W)],
      [corner(0, 0, W), corner(0, H, W)],
    ];
    ctx.strokeStyle = "rgba(71, 85, 105, 0.55)";
    ctx.lineWidth = 1.2;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Door end: cargo is packed from the nose, so the doors sit at x = length.
    ctx.strokeStyle = "rgba(13, 148, 136, 0.7)";
    ctx.lineWidth = 2;
    const doorA = corner(L, 0, 0);
    const doorB = corner(L, H, 0);
    const doorC = corner(L, H, W);
    const doorD = corner(L, 0, W);
    ctx.beginPath();
    ctx.moveTo(doorA.x, doorA.y);
    ctx.lineTo(doorB.x, doorB.y);
    ctx.lineTo(doorC.x, doorC.y);
    ctx.lineTo(doorD.x, doorD.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(13, 148, 136, 0.9)";
    ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    const doorLabel = view.project({ x: L + 4, y: 4, z: W / 2 });
    ctx.fillText("DOORS", doorLabel.x, doorLabel.y);

    const faces: Face[] = [];
    for (const box of renderBoxes) {
      faces.push(...boxFaces(box, view, box.id === selectedId, box.id === hovered));
    }
    faces.sort((a, b) => b.depth - a.depth);

    for (const face of faces) {
      if (!tracePath(ctx, face.points)) continue;
      ctx.fillStyle = face.fill;
      ctx.fill();
      ctx.strokeStyle = face.stroke;
      ctx.lineWidth = face.lineWidth;
      ctx.stroke();

      if (face.fragile) {
        // Hatch the top of fragile cargo so it reads at a glance.
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1;
        const minX = Math.min(...face.points.map((p) => p.x));
        const maxX = Math.max(...face.points.map((p) => p.x));
        const minY = Math.min(...face.points.map((p) => p.y));
        const maxY = Math.max(...face.points.map((p) => p.y));
        for (let i = minX - (maxY - minY); i < maxX; i += 8) {
          ctx.beginPath();
          ctx.moveTo(i, maxY);
          ctx.lineTo(i + (maxY - minY), minY);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Selected package label, drawn last so it is never hidden.
    const selected = renderBoxes.find((box) => box.id === selectedId);
    if (selected?.placement) {
      const labelPoint = view.project({
        x:
          selected.placement.xCm +
          (selected.placement.rotated ? selected.widthCm : selected.lengthCm) / 2,
        y: selected.placement.yCm + selected.heightCm + 8,
        z:
          selected.placement.zCm +
          (selected.placement.rotated ? selected.lengthCm : selected.widthCm) / 2,
      });
      const text = selected.label;
      ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
      const width = ctx.measureText(text).width + 12;
      ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
      ctx.beginPath();
      ctx.roundRect(labelPoint.x - width / 2, labelPoint.y - 20, width, 18, 4);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText(text, labelPoint.x, labelPoint.y - 7);
    }

    // Centre of gravity line
    const placed = renderBoxes.filter((box) => box.placement);
    if (placed.length > 0) {
      let mass = 0;
      let cx = 0;
      let cz = 0;
      for (const box of placed) {
        const placement = box.placement as Placement;
        const l = placement.rotated ? box.widthCm : box.lengthCm;
        const w = placement.rotated ? box.lengthCm : box.widthCm;
        const m = box.weightKg > 0 ? box.weightKg : 1;
        cx += (placement.xCm + l / 2) * m;
        cz += (placement.zCm + w / 2) * m;
        mass += m;
      }
      cx /= mass;
      cz /= mass;
      const base = view.project({ x: cx, y: 0, z: cz });
      const top = view.project({ x: cx, y: spec.heightCm, z: cz });
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "rgba(220, 38, 38, 0.75)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(base.x, base.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220, 38, 38, 0.9)";
      ctx.fill();
    }
  }, [spec, renderBoxes, selectedId, hovered, size.width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  const hitTest = (point: Point2): string | null => {
    const view = viewRef.current;
    if (!view) return null;
    const candidates = renderBoxes
      .filter((box) => box.placement)
      .map((box) => ({ id: box.id, hull: silhouette(view, box) }))
      .sort((a, b) => {
        const da = view.depthOf(boxCenter(a.id));
        const db = view.depthOf(boxCenter(b.id));
        return da - db;
      });
    for (const candidate of candidates) {
      if (pointInPolygon(point, candidate.hull)) return candidate.id;
    }
    return null;
  };

  function boxCenter(id: string): Vec3 {
    const box = renderBoxes.find((row) => row.id === id);
    if (!box?.placement) return { x: 0, y: 0, z: 0 };
    const l = box.placement.rotated ? box.widthCm : box.lengthCm;
    const w = box.placement.rotated ? box.lengthCm : box.widthCm;
    return {
      x: box.placement.xCm + l / 2,
      y: box.placement.yCm + box.heightCm / 2,
      z: box.placement.zCm + w / 2,
    };
  }

  const localPoint = (event: React.PointerEvent): Point2 => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const id = hitTest(point);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture can fail if the pointer already ended; the drag still works via bubbling.
    }
    if (!id) {
      onSelect(null);
      orbitRef.current = {
        yaw: cameraRef.current.yaw,
        pitch: cameraRef.current.pitch,
        pointer: point,
      };
      return;
    }
    const box = boxes.find((row) => row.id === id);
    if (!box?.placement) return;
    onSelect(id);
    dragRef.current = {
      id,
      start: { ...box.placement },
      pointer: point,
      moved: false,
      next: null,
    };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const orbit = orbitRef.current;
    if (orbit) {
      cameraRef.current = {
        ...cameraRef.current,
        yaw: orbit.yaw + (point.x - orbit.pointer.x) * 0.006,
        pitch: Math.max(-0.2, Math.min(1.5, orbit.pitch - (point.y - orbit.pointer.y) * 0.005)),
      };
      draw();
      return;
    }

    const drag = dragRef.current;
    const view = viewRef.current;
    if (drag && view) {
      const base = drag.start;
      const origin = view.project({ x: base.xCm, y: base.yCm, z: base.zCm });
      const axisX = view.project({ x: base.xCm + 100, y: base.yCm, z: base.zCm });
      const axisZ = view.project({ x: base.xCm, y: base.yCm, z: base.zCm + 100 });
      const bx = axisX.x - origin.x;
      const by = axisX.y - origin.y;
      const cz = axisZ.x - origin.x;
      const dz = axisZ.y - origin.y;
      const det = bx * dz - cz * by;
      const dx = point.x - drag.pointer.x;
      const dy = point.y - drag.pointer.y;
      if (Math.abs(det) > 1e-6) {
        const a = ((dx * dz - cz * dy) / det) * 100;
        const b = ((bx * dy - dx * by) / det) * 100;
        const box = boxes.find((row) => row.id === drag.id);
        if (box) {
          const l = base.rotated ? box.widthCm : box.lengthCm;
          const w = base.rotated ? box.lengthCm : box.widthCm;
          const next: Placement = {
            ...base,
            xCm: Math.max(0, Math.min(spec.lengthCm - l, Math.round(base.xCm + a))),
            zCm: Math.max(0, Math.min(spec.widthCm - w, Math.round(base.zCm + b))),
          };
          drag.moved = drag.moved || Math.abs(a) + Math.abs(b) > 3;
          drag.next = next;
          setDraft({ id: drag.id, placement: next });
        }
      }
      return;
    }

    const hover = hitTest(point);
    if (hover !== hovered) setHovered(hover);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    orbitRef.current = null;
    setDragging(false);
    // Commit from the ref, not from React state: a fast drag can finish in the same
    // frame as the last pointer move.
    if (drag?.moved && drag.next) onMove(drag.id, drag.next);
    setDraft(null);
  };

  // Native listener so `preventDefault` is allowed (React registers wheel as passive).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraRef.current = {
        ...cameraRef.current,
        zoom: Math.max(
          0.45,
          Math.min(3.4, cameraRef.current.zoom * (event.deltaY < 0 ? 1.12 : 0.89)),
        ),
      };
      draw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ height }}
      role="img"
      aria-label={`3D load plan for a ${spec.name}`}
    >
      <canvas
        ref={canvasRef}
        className={dragging ? "cursor-grabbing" : hovered ? "cursor-grab" : "cursor-move"}
        style={{ display: "block", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !dragRef.current && setHovered(null)}
      />
    </div>
  );
}
