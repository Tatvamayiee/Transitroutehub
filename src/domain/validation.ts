import { z } from "zod";

const emailField = z.string().email("Enter a valid email address.").max(255, "Email is too long.");

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

const tokenField = z.string().min(1, "You must be signed in.");

// ---------------- auth ----------------

export const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your full name.").max(100, "Name is too long."),
    email: emailField,
    company: z.string().max(120, "Company name is too long.").optional().default(""),
    role: z.enum(["trader", "provider", "admin"]),
    password: passwordField,
    confirm: z.string().max(128),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirm: z.string().max(128),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const logoutSchema = z.object({ token: z.string().max(128) });

// ---------------- routes & containers ----------------

export const laneSchema = z.object({
  token: tokenField,
  origin: z.string().min(2, "Origin is required.").max(120),
  destination: z.string().min(2, "Destination is required.").max(120),
  mode: z.enum(["road", "rail", "sea", "air"]),
  scheduledAt: z.string().min(1, "Pick a departure date."),
});

export const containerSchema = z.object({
  token: tokenField,
  laneId: z.string().min(1, "Pick a route."),
  label: z.string().min(2, "Give the container a reference.").max(60),
  capacityM3: z.number().positive("Capacity must be greater than zero.").max(100_000),
  availableM3: z.number().min(0, "Available space cannot be negative.").max(100_000),
  pricePerM3: z.number().min(0, "Price cannot be negative.").max(1_000_000),
});

export const updateContainerSchema = z.object({
  token: tokenField,
  containerId: z.string().min(1),
  availableM3: z.number().min(0).max(100_000),
  pricePerM3: z.number().min(0).max(1_000_000),
  status: z.enum(["available", "inactive"]),
});

// ---------------- bookings ----------------

export const bookingSchema = z.object({
  token: tokenField,
  containerId: z.string().min(1, "Pick a container."),
  requestedM3: z.number().positive("Booking must be greater than zero.").max(100_000),
});

// ---------------- cargo photos ----------------

export const cargoPhotoUploadSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
  label: z.string().trim().min(2, "Describe what the photograph shows.").max(120),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  // ~3 MiB of binary, base64-encoded. The same ceiling is enforced on the bucket.
  dataBase64: z.string().min(64).max(4_200_000),
});

export const cargoReviewSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(400).optional().default(""),
});

export const cargoReopenSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
  note: z.string().max(400).optional().default(""),
});

export const cargoHistorySchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
});

export const bookingStatusSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
  status: z.enum(["pending", "confirmed", "in_transit", "delivered", "cancelled"]),
});

export const cancelBookingSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
  reason: z.string().max(240).optional().default(""),
});

// ---------------- payments ----------------

export const escrowActionSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
});

// ---------------- verification ----------------

export const verificationSchema = z.object({
  token: tokenField,
  legalName: z.string().min(2, "Registered legal name is required.").max(160),
  registrationNo: z.string().min(4, "Registration number is required.").max(60),
  taxId: z.string().min(4, "Tax identifier is required.").max(60),
  contactEmail: emailField,
  contactPhone: z.string().min(6, "Contact phone is required.").max(40),
  fleetSize: z.number().int().min(0).max(100_000),
  documentRefs: z.string().max(500).optional().default(""),
});

export const verificationReviewSchema = z.object({
  token: tokenField,
  providerId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(400).optional().default(""),
});

// ---------------- messaging ----------------

export const startThreadSchema = z.object({
  token: tokenField,
  bookingId: z.string().min(1),
});

export const sendMessageSchema = z.object({
  token: tokenField,
  threadId: z.string().min(1),
  body: z.string().min(1, "Write a message first.").max(1000),
});

export const notificationReadSchema = z.object({
  token: tokenField,
  notificationId: z.string().min(1),
});

export const markAllReadSchema = z.object({ token: tokenField });

// ---------------- admin ----------------

export const setUserRoleSchema = z.object({
  token: tokenField,
  userId: z.string().min(1),
  role: z.enum(["trader", "provider", "admin"]),
});

// ---------------- reports ----------------

export const reportSchema = z.object({
  token: tokenField,
  window: z.enum(["30d", "90d", "all"]).optional().default("90d"),
});

export type LaneInput = z.infer<typeof laneSchema>;
export type ContainerInput = z.infer<typeof containerSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type VerificationInput = z.infer<typeof verificationSchema>;
export type CargoPhotoUploadInput = z.infer<typeof cargoPhotoUploadSchema>;
export type CargoReviewInput = z.infer<typeof cargoReviewSchema>;
