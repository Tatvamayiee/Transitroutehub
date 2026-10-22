export type UserRole = "trader" | "provider" | "admin";

export const ROLE_LABELS: Record<UserRole, string> = {
  trader: "Trader / Shipper",
  provider: "Logistics Provider",
  admin: "Administrator",
};

export type User = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  createdAt: string;
};

export type RouteMode = "road" | "rail" | "sea" | "air";

export const MODE_LABELS: Record<RouteMode, string> = {
  road: "Road",
  rail: "Rail",
  sea: "Sea",
  air: "Air",
};

export type ContainerStatus = "available" | "booked" | "inactive";

/**
 * A scheduled lane between two points. Named `Lane` (not `Route`) so that it does
 * not collide with the `Route` export that every TanStack file-route module needs.
 */
export type Lane = {
  id: string;
  providerId: string;
  origin: string;
  destination: string;
  mode: RouteMode;
  scheduledAt: string;
  createdAt: string;
};

export type Container = {
  id: string;
  providerId: string;
  laneId: string;
  label: string;
  capacityM3: number;
  availableM3: number;
  pricePerM3: number;
  status: ContainerStatus;
  createdAt: string;
};

export type BookingStatus = "pending" | "confirmed" | "in_transit" | "delivered" | "cancelled";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type Booking = {
  id: string;
  userId: string;
  providerId: string;
  containerId: string;
  requestedM3: number;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
};

export type PaymentStatus = "unfunded" | "funded" | "released" | "refunded";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unfunded: "Awaiting funds",
  funded: "In escrow",
  released: "Released to provider",
  refunded: "Refunded",
};

export type Payment = {
  id: string;
  bookingId: string;
  traderId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export type Thread = {
  id: string;
  bookingId: string;
  traderId: string;
  providerId: string;
  createdAt: string;
};

export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

export type NotificationKind = "booking" | "payment" | "verification" | "system";

export type Notification = {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Not submitted",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export type ProviderVerification = {
  id: string;
  providerId: string;
  legalName: string;
  registrationNo: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
  fleetSize: number;
  documentRefs: string;
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerId: string | null;
  reviewNote: string;
};

export type AuditEvent = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  at: string;
};

export type InsightSeverity = "info" | "warning" | "critical";

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  metric: string;
  action: string;
};

// ---------------- read models ----------------

/** A bookable container joined with its lane and provider. */
export type SpaceListing = {
  container: Container;
  lane: Lane;
  providerName: string;
  providerVerified: boolean;
};

export type LaneAggregate = {
  lane: Lane;
  providerName: string;
  containerCount: number;
  capacityM3: number;
  availableM3: number;
  utilisationPct: number;
  cheapestPricePerM3: number;
};

export type CapacitySummary = {
  totalCapacityM3: number;
  totalAvailableM3: number;
  utilisationPct: number;
  laneCount: number;
  containerCount: number;
  aggregatedLanes: LaneAggregate[];
  byMode: Array<{
    mode: RouteMode;
    containerCount: number;
    capacityM3: number;
    availableM3: number;
  }>;
};

/** A booking joined with its container, lane, counterparties and escrow state. */
export type BookingView = {
  booking: Booking;
  container: Container;
  lane: Lane;
  providerName: string;
  traderName: string;
  paymentStatus: PaymentStatus;
  amount: number;
};

/** A booking conversation, joined with its counterparty and latest message. */
export type ThreadView = {
  thread: Thread;
  bookingId: string;
  counterpartyName: string;
  counterpartyRole: UserRole;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
};

export type VerificationView = {
  verification: ProviderVerification;
  providerName: string;
  providerCompany: string;
  providerEmail: string;
  laneCount: number;
  containerCount: number;
};

export type AdminUserView = {
  user: User;
  laneCount: number;
  containerCount: number;
  bookingCount: number;
  verificationStatus: VerificationStatus;
};

export type ReportSeries = Array<{ label: string; value: number }>;

export type ReportPayload = {
  window: string;
  generatedAt: string;
  summary: {
    bookings: number;
    grossValue: number;
    escrowHeld: number;
    released: number;
    refunded: number;
    avgUtilisationPct: number;
    cancellationRatePct: number;
    verifiedProviders: number;
    bookingsPerLane: number;
  };
  byStatus: ReportSeries;
  byMode: ReportSeries;
  topLanes: Array<{
    laneId: string;
    label: string;
    bookings: number;
    bookedM3: number;
    value: number;
    utilisationPct: number;
  }>;
  byProvider: Array<{
    providerId: string;
    providerName: string;
    bookings: number;
    shippedM3: number;
    value: number;
  }>;
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "Manage users and roles",
    "Review provider verification",
    "Monitor containers and capacity",
    "View booking and revenue reports",
    "Release or refund escrow",
  ],
  provider: [
    "Submit verification documents",
    "Manage routes and containers",
    "Respond to bookings",
    "Message traders about a shipment",
  ],
  trader: [
    "Search cargo space",
    "Book and manage shipments",
    "Fund escrow and release on delivery",
    "Message providers about a shipment",
  ],
};
