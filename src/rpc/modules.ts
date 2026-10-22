/**
 * Server functions for the payments/escrow, communication, verification,
 * admin and reporting modules.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  escrowActionSchema,
  markAllReadSchema,
  notificationReadSchema,
  reportSchema,
  sendMessageSchema,
  setUserRoleSchema,
  startThreadSchema,
  verificationReviewSchema,
  verificationSchema,
} from "@/domain/validation";
import {
  adminOverview,
  fundEscrow,
  generateReport,
  getMyVerification,
  listAudit,
  listInsights,
  listLedger,
  listMessages,
  listNotifications,
  listThreads,
  listUsers,
  listVerifications,
  markAllNotificationsRead,
  markNotificationRead,
  refundEscrow,
  releaseEscrow,
  reviewVerification,
  sendMessage,
  setUserRole,
  startThreadForBooking,
  submitVerification,
} from "@/server/services/modules";

const tokenSchema = z.object({ token: z.string().min(1) });
const threadIdSchema = z.object({ token: z.string().min(1), threadId: z.string().min(1) });

// ---------------- payments & escrow ----------------

export const serverListLedger = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listLedger(data.token));

export const serverFundEscrow = createServerFn({ method: "POST" })
  .validator(escrowActionSchema)
  .handler(({ data }) => fundEscrow(data.token, data.bookingId));

export const serverReleaseEscrow = createServerFn({ method: "POST" })
  .validator(escrowActionSchema)
  .handler(({ data }) => releaseEscrow(data.token, data.bookingId));

export const serverRefundEscrow = createServerFn({ method: "POST" })
  .validator(escrowActionSchema)
  .handler(({ data }) => refundEscrow(data.token, data.bookingId));

// ---------------- communication ----------------

export const serverListThreads = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listThreads(data.token));

export const serverListMessages = createServerFn({ method: "POST" })
  .validator(threadIdSchema)
  .handler(({ data }) => listMessages(data.token, data.threadId));

export const serverSendMessage = createServerFn({ method: "POST" })
  .validator(sendMessageSchema)
  .handler(({ data }) => sendMessage(data.token, data.threadId, data.body));

export const serverStartThread = createServerFn({ method: "POST" })
  .validator(startThreadSchema)
  .handler(({ data }) => startThreadForBooking(data.token, data.bookingId));

export const serverListNotifications = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listNotifications(data.token));

export const serverMarkNotificationRead = createServerFn({ method: "POST" })
  .validator(notificationReadSchema)
  .handler(({ data }) => markNotificationRead(data.token, data.notificationId));

export const serverMarkAllNotificationsRead = createServerFn({ method: "POST" })
  .validator(markAllReadSchema)
  .handler(({ data }) => markAllNotificationsRead(data.token));

// ---------------- verification ----------------

export const serverGetMyVerification = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => getMyVerification(data.token));

export const serverSubmitVerification = createServerFn({ method: "POST" })
  .validator(verificationSchema)
  .handler(({ data }) =>
    submitVerification(data.token, {
      legalName: data.legalName,
      registrationNo: data.registrationNo,
      taxId: data.taxId,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      fleetSize: data.fleetSize,
      documentRefs: data.documentRefs,
    }),
  );

export const serverListVerifications = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listVerifications(data.token));

export const serverReviewVerification = createServerFn({ method: "POST" })
  .validator(verificationReviewSchema)
  .handler(({ data }) =>
    reviewVerification(data.token, {
      providerId: data.providerId,
      decision: data.decision,
      note: data.note,
    }),
  );

// ---------------- admin ----------------

export const serverAdminOverview = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => adminOverview(data.token));

export const serverListUsers = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listUsers(data.token));

export const serverSetUserRole = createServerFn({ method: "POST" })
  .validator(setUserRoleSchema)
  .handler(({ data }) => setUserRole(data.token, { userId: data.userId, role: data.role }));

export const serverListAudit = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listAudit(data.token));

// ---------------- reports ----------------

export const serverGenerateReport = createServerFn({ method: "POST" })
  .validator(reportSchema)
  .handler(({ data }) => generateReport(data.token, data.window));

export const serverListInsights = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(({ data }) => listInsights(data.token));
