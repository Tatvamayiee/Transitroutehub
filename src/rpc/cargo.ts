/**
 * Server functions for the cargo-photo upload and provider review workflow.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  cargoHistorySchema,
  cargoPhotoUploadSchema,
  cargoReopenSchema,
  cargoReviewSchema,
} from "@/domain/validation";
import {
  cargoPendingCount,
  cargoPhotoHistory,
  cargoReviewQueue,
  reopenCargoPhoto,
  reviewCargoPhoto,
  submitCargoPhoto,
} from "@/server/services/cargo";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });

export const serverSubmitCargoPhoto = createServerFn({ method: "POST" })
  .validator(cargoPhotoUploadSchema)
  .handler(({ data }) =>
    submitCargoPhoto(data.token, {
      bookingId: data.bookingId,
      label: data.label,
      contentType: data.contentType,
      dataBase64: data.dataBase64,
    }),
  );

export const serverReviewCargoPhoto = createServerFn({ method: "POST" })
  .validator(cargoReviewSchema)
  .handler(({ data }) =>
    reviewCargoPhoto(data.token, {
      bookingId: data.bookingId,
      decision: data.decision,
      note: data.note,
    }),
  );

export const serverReopenCargoPhoto = createServerFn({ method: "POST" })
  .validator(cargoReopenSchema)
  .handler(({ data }) =>
    reopenCargoPhoto(data.token, { bookingId: data.bookingId, note: data.note }),
  );

export const serverCargoReviewQueue = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => cargoReviewQueue(data.token));

export const serverCargoPhotoHistory = createServerFn({ method: "POST" })
  .validator(cargoHistorySchema)
  .handler(({ data }) => cargoPhotoHistory(data.token, { bookingId: data.bookingId }));

export const serverCargoPendingCount = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => cargoPendingCount(data.token));
