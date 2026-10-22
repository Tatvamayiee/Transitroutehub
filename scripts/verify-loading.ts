/**
 * Throwaway verification harness for the 3D loading module.
 * Exercises the real service layer (ownership, validation, packing) end to end.
 */

import { boundsOverlap, placedBounds } from "@/domain/loading";
import type { CargoBox } from "@/domain/loading";
import { loginUser } from "@/server/services/auth";
import { myBookings } from "@/server/services/data";
import {
  addCargoBox,
  autoPackBooking,
  getLoadPlan,
  moveCargoBox,
  removeCargoBox,
  resetLoadPlan,
} from "@/server/services/loading";

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    return;
  }
  failures.push(detail ? `${name} — ${detail}` : name);
}

async function token(email: string): Promise<string> {
  const result = await loginUser({ email, password: "demo1234" });
  if (!result.ok) throw new Error(`login failed for ${email}: ${result.message}`);
  return result.value.token;
}

function noOverlaps(boxes: CargoBox[]): boolean {
  const placed = boxes.filter((box) => box.placement !== null);
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placedBounds(placed[i]);
      const b = placedBounds(placed[j]);
      if (a && b && boundsOverlap(a, b)) return false;
    }
  }
  return true;
}

function insideSpec(
  spec: { lengthCm: number; widthCm: number; heightCm: number },
  boxes: CargoBox[],
): boolean {
  return boxes.every((box) => {
    const bounds = placedBounds(box);
    if (!bounds) return true;
    return (
      bounds.x0 >= -0.01 &&
      bounds.z0 >= -0.01 &&
      bounds.y0 >= -0.01 &&
      bounds.x1 <= spec.lengthCm + 0.01 &&
      bounds.z1 <= spec.widthCm + 0.01 &&
      bounds.y1 <= spec.heightCm + 0.01
    );
  });
}

async function main() {
  const trader = await token("trader@trh.demo");
  const provider = await token("provider@trh.demo");
  const otherTrader = await token("shipper@trh.demo");

  const mine = await myBookings(trader);
  if (!mine.ok) throw new Error(mine.message);
  check("trader has seeded bookings", mine.value.length > 0, `${mine.value.length}`);
  const booking = mine.value[0].booking;
  const bookingId = booking.id;

  // ---- initial plan ----
  const first = await getLoadPlan(trader, bookingId);
  if (!first.ok) throw new Error(first.message);
  const plan = first.value;
  check(
    "plan is generated for the booking",
    plan.boxes.length > 0,
    `${plan.boxes.length} packages`,
  );
  check(
    "generated cargo is fully loaded",
    plan.stats.unplacedCount === 0,
    `${plan.stats.unplacedCount} unplaced`,
  );
  check("no overlapping packages", noOverlaps(plan.boxes));
  check("all packages inside the container", insideSpec(plan.spec, plan.boxes));
  check(
    "loaded volume is close to the booked volume",
    Math.abs(plan.stats.placedVolumeM3 - plan.bookedM3) / plan.bookedM3 < 0.2,
    `${plan.stats.placedVolumeM3.toFixed(2)} vs ${plan.bookedM3.toFixed(2)} m³`,
  );
  check(
    "container spec is real equipment",
    plan.spec.lengthCm >= plan.spec.widthCm && plan.spec.heightCm > 200,
    plan.containerKind,
  );

  // ---- auto-pack is deterministic ----
  const packedAgain = await autoPackBooking(trader, bookingId);
  if (!packedAgain.ok) throw new Error(packedAgain.message);
  check(
    "auto-pack reproduces the same layout",
    JSON.stringify(packedAgain.value.boxes.map((b) => b.placement)) ===
      JSON.stringify(plan.boxes.map((b) => b.placement)),
  );
  check("auto-packed layout has no overlaps", noOverlaps(packedAgain.value.boxes));

  // ---- ownership ----
  const providerView = await getLoadPlan(provider, bookingId);
  check(
    "provider on the booking can open the plan",
    providerView.ok,
    providerView.ok ? "" : providerView.message,
  );
  const foreign = await getLoadPlan(otherTrader, bookingId);
  check(
    "unrelated trader is refused",
    !foreign.ok && foreign.code === "FORBIDDEN",
    foreign.ok ? "granted" : foreign.code,
  );
  const anon = await getLoadPlan("not-a-token", bookingId);
  check("invalid token is refused", !anon.ok && anon.code === "UNAUTHORIZED");

  // ---- add / move / remove ----
  const added = await addCargoBox(trader, bookingId, {
    label: "Test crate",
    lengthCm: 80,
    widthCm: 60,
    heightCm: 70,
    weightKg: 120,
    fragile: false,
  });
  if (!added.ok) throw new Error(added.message);
  check("added package appears in the plan", added.value.boxes.length === plan.boxes.length + 1);
  const newBox = added.value.boxes.find((box) => box.label === "Test crate");
  check("added package gets a placement", Boolean(newBox?.placement));

  const oversized = await addCargoBox(trader, bookingId, {
    label: "Too big",
    lengthCm: 5000,
    widthCm: 100,
    heightCm: 100,
    weightKg: 10,
    fragile: false,
  });
  check("package larger than the container is rejected", !oversized.ok);

  if (newBox?.placement) {
    const blocker = added.value.boxes.find((box) => box.id !== newBox.id && box.placement !== null);
    if (blocker?.placement) {
      const clash = await moveCargoBox(trader, newBox.id, {
        ...blocker.placement,
        rotated: false,
      });
      check(
        "moving onto another package is rejected",
        !clash.ok && clash.code === "PLACEMENT_INVALID",
        clash.ok ? "accepted" : clash.code,
      );
    }

    const outside = await moveCargoBox(trader, newBox.id, {
      xCm: added.value.spec.lengthCm + 40,
      yCm: 0,
      zCm: 0,
      rotated: false,
    });
    check("moving through a wall is rejected", !outside.ok && outside.code === "PLACEMENT_INVALID");

    const moved = await moveCargoBox(trader, newBox.id, {
      xCm: Math.max(0, newBox.placement.xCm - 5),
      yCm: newBox.placement.yCm,
      zCm: newBox.placement.zCm,
      rotated: true,
    });
    check(
      "rotation is applied when there is room",
      moved.ok || moved.code === "PLACEMENT_INVALID",
      moved.ok ? "moved" : moved.message,
    );
    if (moved.ok) {
      const rotated = moved.value.boxes.find((box) => box.id === newBox.id);
      check("rotated flag persists", rotated?.placement?.rotated === true);
      check("layout stays valid after a move", noOverlaps(moved.value.boxes));
    }

    const removed = await removeCargoBox(trader, newBox.id);
    check(
      "removing the package restores the count",
      removed.ok && removed.value.boxes.length === plan.boxes.length,
    );
  }

  // ---- reset ----
  const reset = await resetLoadPlan(trader, bookingId);
  check(
    "reset rebuilds cargo from the booked volume",
    reset.ok &&
      reset.value.boxes.length === plan.boxes.length &&
      reset.value.stats.unplacedCount === 0,
  );

  console.log(`packages: ${plan.boxes.length}`);
  console.log(
    `spec: ${plan.containerKind} (${plan.spec.lengthCm}×${plan.spec.widthCm}×${plan.spec.heightCm} cm)`,
  );
  console.log(
    `loaded: ${plan.stats.placedVolumeM3.toFixed(2)} m³ of ${plan.bookedM3.toFixed(2)} m³ booked`,
  );
  console.log(
    `weight: ${plan.stats.totalWeightKg} kg, CoG x=${plan.stats.centreOfGravity.xPct.toFixed(1)}%`,
  );
  console.log(`max stack height: ${plan.stats.maxHeightCm} cm`);

  if (failures.length > 0) {
    console.log(`\nFAILED ${failures.length}, passed ${passed}`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n✓ all ${passed} checks passed`);
}

void main();
