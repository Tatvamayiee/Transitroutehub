/**
 * Client-facing API for every platform module.
 *
 * Route components import from here (never from `@/server/**` directly), so the
 * server-only store and services stay out of the client bundle.
 */

import { useCallback, useEffect, useState } from "react";
import {
  serverAdminOverview,
  serverAggregateCapacity,
  serverAllBookings,
  serverBookingDetails,
  serverCancelBooking,
  serverCargoPendingCount,
  serverCargoReviewQueue,
  serverCreateBooking,
  serverCreateContainer,
  serverCreateLane,
  serverFundEscrow,
  serverGenerateReport,
  serverGetMyVerification,
  serverListAudit,
  serverListContainersForLane,
  serverListInsights,
  serverListLanes,
  serverListLedger,
  serverListMessages,
  serverListMyContainers,
  serverListMyLanes,
  serverListNotifications,
  serverListThreads,
  serverListUsers,
  serverListVerifications,
  serverLoadPlan,
  serverAddCargoBox,
  serverUpdateCargoBox,
  serverRemoveCargoBox,
  serverMoveCargoBox,
  serverAutoPackBooking,
  serverResetLoadPlan,
  serverMarkAllNotificationsRead,
  serverMarkNotificationRead,
  serverMyBookings,
  serverProviderBookings,
  serverRefundEscrow,
  serverReleaseEscrow,
  serverReopenCargoPhoto,
  serverReviewCargoPhoto,
  serverReviewVerification,
  serverSearchSpace,
  serverSendMessage,
  serverSetUserRole,
  serverStartThread,
  serverSubmitCargoPhoto,
  serverSubmitVerification,
  serverUpdateBookingStatus,
  serverUpdateContainer,
} from "@/rpc";
import type { Result } from "@/domain/results";
import type {
  AdminUserView,
  AuditEvent,
  BookingStatus,
  BookingView,
  CargoReviewDecision,
  CapacitySummary,
  Container,
  ContainerStatus,
  Insight,
  Lane,
  Message,
  Notification,
  ProviderVerification,
  ReportPayload,
  RouteMode,
  SpaceListing,
  Thread,
  ThreadView,
  User,
  UserRole,
  VerificationView,
} from "@/domain/types";
import type { DashboardMetrics } from "@/server/services/data";
import type { LoadPlan } from "@/server/services/loading";
import type { CargoBox, ContainerSpec, LoadStats, Placement } from "@/domain/loading";

export type {
  AdminUserView,
  AuditEvent,
  BookingStatus,
  BookingView,
  CargoReviewDecision,
  CapacitySummary,
  Container,
  Insight,
  Lane,
  Message,
  Notification,
  ProviderVerification,
  ReportPayload,
  RouteMode,
  SpaceListing,
  Thread,
  ThreadView,
  User,
  UserRole,
  VerificationView,
  DashboardMetrics,
};

// ---------------- catalog: lanes & containers ----------------

export const listLanes = (): Promise<Result<Lane[]>> => serverListLanes({});

export const listMyLanes = (token: string) => serverListMyLanes({ data: { token } });

export const createLane = (data: {
  token: string;
  origin: string;
  destination: string;
  mode: RouteMode;
  scheduledAt: string;
}) => serverCreateLane({ data });

export const listContainersForLane = (laneId: string) =>
  serverListContainersForLane({ data: { laneId } });

export const listMyContainers = (token: string) => serverListMyContainers({ data: { token } });

export const createContainer = (data: {
  token: string;
  laneId: string;
  label: string;
  capacityM3: number;
  availableM3: number;
  pricePerM3: number;
}) => serverCreateContainer({ data });

export const updateContainer = (data: {
  token: string;
  containerId: string;
  availableM3: number;
  pricePerM3: number;
  status: "available" | "inactive";
}) => serverUpdateContainer({ data });

// ---------------- catalog: search & aggregation ----------------

export const searchSpace = (data: {
  origin: string;
  destination: string;
  mode: RouteMode | "any";
  minM3: number;
  maxPricePerM3: number;
}) => serverSearchSpace({ data });

export const aggregateCapacity = () => serverAggregateCapacity({});

// ---------------- bookings ----------------

export const createBooking = (data: { token: string; containerId: string; requestedM3: number }) =>
  serverCreateBooking({ data });

export const myBookings = (token: string) => serverMyBookings({ data: { token } });

export const providerBookings = (token: string) => serverProviderBookings({ data: { token } });

export const allBookings = (token: string) => serverAllBookings({ data: { token } });

export const bookingDetails = (token: string, bookingId: string) =>
  serverBookingDetails({ data: { token, bookingId } });

export const updateBookingStatus = (data: {
  token: string;
  bookingId: string;
  status: BookingStatus;
}) => serverUpdateBookingStatus({ data });

export const cancelBooking = (data: { token: string; bookingId: string; reason: string }) =>
  serverCancelBooking({ data });

// ---------------- cargo photos ----------------

export const submitCargoPhoto = (data: {
  token: string;
  bookingId: string;
  label: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}) => serverSubmitCargoPhoto({ data });

export const reviewCargoPhoto = (data: {
  token: string;
  bookingId: string;
  decision: CargoReviewDecision;
  note: string;
}) => serverReviewCargoPhoto({ data });

export const reopenCargoPhoto = (data: { token: string; bookingId: string; note: string }) =>
  serverReopenCargoPhoto({ data });

export const cargoReviewQueue = (token: string) => serverCargoReviewQueue({ data: { token } });

/** Photos awaiting this provider's decision — powers the navigation badge. */
export const cargoPendingCount = (token: string) => serverCargoPendingCount({ data: { token } });

/**
 * Fired after any cargo-photo change so the header badge and open lists can
 * refresh without polling.
 */
export const CARGO_CHANGED_EVENT = "trh:cargo-changed";

export function announceCargoChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CARGO_CHANGED_EVENT));
}

// ---------------- payments & escrow ----------------

export const listLedger = (token: string) => serverListLedger({ data: { token } });

export const fundEscrow = (token: string, bookingId: string) =>
  serverFundEscrow({ data: { token, bookingId } });

export const releaseEscrow = (token: string, bookingId: string) =>
  serverReleaseEscrow({ data: { token, bookingId } });

export const refundEscrow = (token: string, bookingId: string) =>
  serverRefundEscrow({ data: { token, bookingId } });

// ---------------- communication ----------------

export const listThreads = (token: string) => serverListThreads({ data: { token } });

export const listMessages = (token: string, threadId: string) =>
  serverListMessages({ data: { token, threadId } });

export const sendMessage = (token: string, threadId: string, body: string) =>
  serverSendMessage({ data: { token, threadId, body } });

export const startThread = (token: string, bookingId: string) =>
  serverStartThread({ data: { token, bookingId } });

export const listNotifications = (token: string) => serverListNotifications({ data: { token } });

export const markNotificationRead = (token: string, notificationId: string) =>
  serverMarkNotificationRead({ data: { token, notificationId } });

export const markAllNotificationsRead = (token: string) =>
  serverMarkAllNotificationsRead({ data: { token } });

// ---------------- provider verification ----------------

export const getMyVerification = (token: string) => serverGetMyVerification({ data: { token } });

export const submitVerification = (data: {
  token: string;
  legalName: string;
  registrationNo: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
  fleetSize: number;
  documentRefs: string;
}) => serverSubmitVerification({ data });

export const listVerifications = (token: string) => serverListVerifications({ data: { token } });

export const reviewVerification = (data: {
  token: string;
  providerId: string;
  decision: "approved" | "rejected";
  note: string;
}) => serverReviewVerification({ data });

// ---------------- admin ----------------

export const adminOverview = (token: string) => serverAdminOverview({ data: { token } });

export const listUsers = (token: string) => serverListUsers({ data: { token } });

export const setUserRole = (token: string, userId: string, role: UserRole) =>
  serverSetUserRole({ data: { token, userId, role } });

export const listAudit = (token: string) => serverListAudit({ data: { token } });

// ---------------- reports ----------------

export const generateReport = (token: string, window: "30d" | "90d" | "all") =>
  serverGenerateReport({ data: { token, window } });

export const listInsights = (token: string) => serverListInsights({ data: { token } });

// ---------------- 3D loading ----------------

export type { CargoBox, ContainerSpec, LoadPlan, LoadStats, Placement };

export type CargoInput = {
  label: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  fragile: boolean;
};

export const loadPlan = (token: string, bookingId: string) =>
  serverLoadPlan({ data: { token, bookingId } });

export const addCargoBox = (token: string, bookingId: string, input: CargoInput) =>
  serverAddCargoBox({ data: { token, bookingId, ...input } });

export const updateCargoBox = (token: string, boxId: string, input: CargoInput) =>
  serverUpdateCargoBox({ data: { token, boxId, ...input } });

export const removeCargoBox = (token: string, boxId: string) =>
  serverRemoveCargoBox({ data: { token, boxId } });

export const moveCargoBox = (token: string, boxId: string, placement: Placement) =>
  serverMoveCargoBox({ data: { token, boxId, ...placement } });

export const autoPackBooking = (token: string, bookingId: string) =>
  serverAutoPackBooking({ data: { token, bookingId } });

export const resetLoadPlan = (token: string, bookingId: string) =>
  serverResetLoadPlan({ data: { token, bookingId } });

// ---------------- data loading hook ----------------

export type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Loads a server function result into component state, re-running whenever the
 * dependency key changes. Returns `reload` so mutations can refresh the view.
 */
export function useServerData<T>(
  key: string,
  load: () => Promise<Result<T>>,
  enabled = true,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: enabled });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void load().then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ data: result.value, error: null, loading: false });
      else setState({ data: null, error: result.message, loading: false });
    });
    return () => {
      cancelled = true;
    };
    // `key` is the deliberate dependency: callers encode every input in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);

  return { ...state, reload };
}
