/**
 * Server functions for the catalog, capacity aggregation and booking modules.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  bookingSchema,
  bookingStatusSchema,
  cancelBookingSchema,
  containerSchema,
  laneSchema,
  updateContainerSchema,
} from "@/domain/validation";
import { z } from "zod";
import {
  aggregateCapacity,
  allBookings,
  bookingDetails,
  cancelBooking,
  createBooking,
  createContainer,
  createLane,
  listContainersForLane,
  listLanes,
  listMyContainers,
  listMyLanes,
  myBookings,
  providerBookings,
  searchSpace,
  updateBookingStatus,
  updateContainer,
} from "@/server/services/data";

const laneIdSchema = z.object({ laneId: z.string().min(1) });
const tokenSchema = z.object({ token: z.string().min(1) });
const bookingIdSchema = z.object({ token: z.string().min(1), bookingId: z.string().min(1) });

// ---------------- lanes ----------------

export const serverListLanes = createServerFn({ method: "GET" }).handler(() => listLanes());

export const serverListMyLanes = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listMyLanes(data.token));

export const serverCreateLane = createServerFn({ method: "POST" })
  .validator(laneSchema)
  .handler(({ data }) =>
    createLane(data.token, {
      origin: data.origin,
      destination: data.destination,
      mode: data.mode,
      scheduledAt: data.scheduledAt,
    }),
  );

// ---------------- containers ----------------

export const serverListContainersForLane = createServerFn({ method: "POST" })
  .validator(laneIdSchema)
  .handler(({ data }) => listContainersForLane(data.laneId));

export const serverListMyContainers = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listMyContainers(data.token));

export const serverCreateContainer = createServerFn({ method: "POST" })
  .validator(containerSchema)
  .handler(({ data }) =>
    createContainer(data.token, {
      laneId: data.laneId,
      label: data.label,
      capacityM3: data.capacityM3,
      availableM3: data.availableM3,
      pricePerM3: data.pricePerM3,
    }),
  );

export const serverUpdateContainer = createServerFn({ method: "POST" })
  .validator(updateContainerSchema)
  .handler(({ data }) =>
    updateContainer(data.token, {
      containerId: data.containerId,
      availableM3: data.availableM3,
      pricePerM3: data.pricePerM3,
      status: data.status,
    }),
  );

// ---------------- search & aggregation ----------------

const searchSchema = z.object({
  origin: z.string().max(120).optional().default(""),
  destination: z.string().max(120).optional().default(""),
  mode: z.enum(["any", "road", "rail", "sea", "air"]).optional().default("any"),
  minM3: z.number().min(0).max(100_000).optional().default(0),
  maxPricePerM3: z.number().min(0).max(1_000_000).optional().default(0),
});

export const serverSearchSpace = createServerFn({ method: "POST" })
  .validator(searchSchema)
  .handler(({ data }) =>
    searchSpace({
      origin: data.origin,
      destination: data.destination,
      mode: data.mode,
      minM3: data.minM3,
      maxPricePerM3: data.maxPricePerM3 > 0 ? data.maxPricePerM3 : undefined,
    }),
  );

export const serverAggregateCapacity = createServerFn({ method: "GET" }).handler(() =>
  aggregateCapacity(),
);

// ---------------- bookings ----------------

export const serverCreateBooking = createServerFn({ method: "POST" })
  .validator(bookingSchema)
  .handler(({ data }) =>
    createBooking(data.token, { containerId: data.containerId, requestedM3: data.requestedM3 }),
  );

export const serverMyBookings = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => myBookings(data.token));

export const serverProviderBookings = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => providerBookings(data.token));

export const serverAllBookings = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => allBookings(data.token));

export const serverBookingDetails = createServerFn({ method: "POST" })
  .validator(bookingIdSchema)
  .handler(({ data }) => bookingDetails(data.token, data.bookingId));

export const serverUpdateBookingStatus = createServerFn({ method: "POST" })
  .validator(bookingStatusSchema)
  .handler(({ data }) =>
    updateBookingStatus(data.token, { bookingId: data.bookingId, status: data.status }),
  );

export const serverCancelBooking = createServerFn({ method: "POST" })
  .validator(cancelBookingSchema)
  .handler(({ data }) =>
    cancelBooking(data.token, { bookingId: data.bookingId, reason: data.reason }),
  );
