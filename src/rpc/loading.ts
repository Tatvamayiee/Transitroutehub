/**
 * Server functions for 3D container loading.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addCargoBox,
  autoPackBooking,
  getLoadPlan,
  moveCargoBox,
  removeCargoBox,
  resetLoadPlan,
  updateCargoBox,
} from "@/server/services/loading";

const planSchema = z.object({ token: z.string().min(1), bookingId: z.string().min(1) });

const cargoSchema = z.object({
  token: z.string().min(1),
  label: z.string().max(60).optional().default(""),
  lengthCm: z.number().positive().max(100_000),
  widthCm: z.number().positive().max(100_000),
  heightCm: z.number().positive().max(100_000),
  weightKg: z.number().min(0).max(1_000_000),
  fragile: z.boolean().optional().default(false),
});

const addSchema = cargoSchema.extend({ bookingId: z.string().min(1) });
const editSchema = cargoSchema.extend({ boxId: z.string().min(1) });

const moveSchema = z.object({
  token: z.string().min(1),
  boxId: z.string().min(1),
  xCm: z.number().min(-1_000).max(100_000),
  yCm: z.number().min(-1_000).max(100_000),
  zCm: z.number().min(-1_000).max(100_000),
  rotated: z.boolean().optional().default(false),
});

export const serverLoadPlan = createServerFn({ method: "POST" })
  .validator(planSchema)
  .handler(({ data }) => getLoadPlan(data.token, data.bookingId));

export const serverAddCargoBox = createServerFn({ method: "POST" })
  .validator(addSchema)
  .handler(({ data }) =>
    addCargoBox(data.token, data.bookingId, {
      label: data.label,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      fragile: data.fragile,
    }),
  );

export const serverUpdateCargoBox = createServerFn({ method: "POST" })
  .validator(editSchema)
  .handler(({ data }) =>
    updateCargoBox(data.token, data.boxId, {
      label: data.label,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      fragile: data.fragile,
    }),
  );

export const serverRemoveCargoBox = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(1), boxId: z.string().min(1) }))
  .handler(({ data }) => removeCargoBox(data.token, data.boxId));

export const serverMoveCargoBox = createServerFn({ method: "POST" })
  .validator(moveSchema)
  .handler(({ data }) =>
    moveCargoBox(data.token, data.boxId, {
      xCm: data.xCm,
      yCm: data.yCm,
      zCm: data.zCm,
      rotated: data.rotated,
    }),
  );

export const serverAutoPackBooking = createServerFn({ method: "POST" })
  .validator(planSchema)
  .handler(({ data }) => autoPackBooking(data.token, data.bookingId));

export const serverResetLoadPlan = createServerFn({ method: "POST" })
  .validator(planSchema)
  .handler(({ data }) => resetLoadPlan(data.token, data.bookingId));
