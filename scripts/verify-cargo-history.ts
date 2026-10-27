/**
 * Throwaway verification harness for the cargo-photo history (0003).
 *
 * Exercises the real service layer against the project database:
 *  - a replacement archives the previous version, and the superseded object stays
 *    in the private bucket so it can still be displayed;
 *  - a reopen archives the decision it clears, and the same object is never
 *    archived twice afterwards;
 *  - only the booking's trader, its provider and admins may read the history.
 *
 *   npx --yes vite-node@3 scripts/verify-cargo-history.ts
 *
 * It mutates demo data: it replaces the chosen booking's photograph, walks it
 * through reject / reopen / approve, then uploads the original bytes back so the
 * booking ends up pending with its own photo, exactly as it was found. The
 * superseded versions stay archived — that is the feature.
 */
import { readFileSync } from "node:fs";
import { loginUser } from "@/server/services/auth";
import {
  cargoPhotoHistory,
  cargoPendingCount,
  cargoReviewQueue,
  reopenCargoPhoto,
  reviewCargoPhoto,
  submitCargoPhoto,
} from "@/server/services/cargo";
import { myBookings } from "@/server/services/data";
import { signedCargoPhotoUrls } from "@/server/services/storage";
import { findBookingById } from "@/server/store";
import type { CargoPhotoType } from "@/server/services/storage";

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    return;
  }
  failures.push(detail ? `${name} — ${detail}` : name);
}

async function session(email: string) {
  const result = await loginUser({ email, password: "demo1234" });
  if (!result.ok) throw new Error(`login failed for ${email}: ${result.message}`);
  return result.value;
}

/** Two visibly different committed images stand in for a trader's photographs. */
function payload(file: string): { contentType: "image/png"; dataBase64: string } {
  return { contentType: "image/png", dataBase64: readFileSync(file).toString("base64") };
}

function contentTypeForPath(path: string): CargoPhotoType {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function fetchStatus(url: string): Promise<{ status: number; type: string }> {
  const response = await fetch(url);
  return { status: response.status, type: response.headers.get("content-type") ?? "" };
}

async function main() {
  const trader = await session("trader@trh.demo");
  const provider = await session("provider@trh.demo");
  const admin = await session("admin@trh.demo");
  const otherTrader = await session("shipper@trh.demo");
  const otherProvider = await session("carrier@trh.demo");

  const mine = await myBookings(trader.token);
  if (!mine.ok) throw new Error(mine.message);
  const target =
    mine.value.find(
      (view) =>
        view.booking.providerId === provider.user.id &&
        view.booking.cargoPhotoPath !== null &&
        view.booking.status !== "cancelled" &&
        view.booking.status !== "delivered",
    ) ??
    mine.value.find(
      (view) =>
        view.booking.providerId === provider.user.id &&
        view.booking.status !== "cancelled" &&
        view.booking.status !== "delivered",
    );
  if (!target)
    throw new Error("no replaceable seeded booking between trader@trh.demo and provider@trh.demo");
  const bookingId = target.booking.id;

  const preState = await findBookingById(bookingId);
  if (!preState) throw new Error("booking vanished");
  const priorPath = preState.cargoPhotoPath;
  const priorLabel = preState.cargoPhotoLabel ?? "";

  // Whatever a previous run left behind, start from a replaceable state. An
  // approval can only be undone by reopening, which itself archives the photo —
  // so remember whether that already happened before measuring the baseline.
  const reopenedUpFront = preState.reviewStatus === "approved";
  if (reopenedUpFront) {
    const reopened = await reopenCargoPhoto(provider.token, { bookingId, note: "" });
    check(
      "a stale approval can be reopened first",
      reopened.ok,
      reopened.ok ? "" : reopened.message,
    );
  }

  const before = await cargoPhotoHistory(trader.token, { bookingId });
  if (!before.ok) throw new Error(before.message);
  const baseline = before.value.length;

  // ---- replacement archives the previous version -------------------------
  const firstLabel = "History check — frame A";
  const first = await submitCargoPhoto(trader.token, {
    bookingId,
    label: firstLabel,
    ...payload("screenshots/stacking-fixed.png"),
  });
  check(
    "trader can replace the photograph",
    first.ok,
    first.ok ? "" : `${first.code}: ${first.message}`,
  );
  if (!first.ok) throw new Error(`cannot continue without an upload: ${first.message}`);
  const frameAPath = first.value.booking.cargoPhotoPath;

  const afterFirst = await cargoPhotoHistory(trader.token, { bookingId });
  const archived = afterFirst.ok ? afterFirst.value : [];
  // A photo reopened above is already archived, so the replacement adds nothing.
  const expectedAfterFirst = baseline + (priorPath && !reopenedUpFront ? 1 : 0);
  check(
    "the superseded version is archived",
    archived.length === expectedAfterFirst,
    `${baseline} → ${archived.length}, expected ${expectedAfterFirst}`,
  );
  check(
    "history is newest first",
    archived.every((entry, i) => i === 0 || archived[i - 1]!.supersededAt >= entry.supersededAt),
  );
  check(
    "every archived version has a signed URL",
    archived.every((entry) => entry.url !== null),
  );

  const prior = archived.find((entry) => entry.path === priorPath);
  if (priorPath) {
    check("the archived entry points at the superseded object", Boolean(prior));
    check(
      "the archived entry keeps the earlier label and size",
      prior?.label === priorLabel && prior?.bytes === preState.cargoPhotoBytes,
      `label=${prior?.label} bytes=${prior?.bytes}`,
    );
    check(
      "the archived entry records the decision it had",
      prior?.reviewStatus === preState.reviewStatus,
      `archived=${prior?.reviewStatus} was=${preState.reviewStatus}`,
    );
    check(
      "the archived entry says why it left the current slot",
      prior?.reason === (reopenedUpFront ? "reopened" : "replaced"),
      `${prior?.reason}`,
    );
    const traderRead = prior?.url ? await fetchStatus(prior.url) : { status: 0, type: "" };
    check(
      "the superseded object is retained and readable by the trader",
      traderRead.status === 200 && traderRead.type.startsWith("image/"),
      `HTTP ${traderRead.status} ${traderRead.type}`,
    );
    const providerUrls = priorPath
      ? await signedCargoPhotoUrls(provider.token, [priorPath])
      : new Map<string, string>();
    const providerUrl = providerUrls.get(priorPath ?? "");
    const providerRead = providerUrl ? await fetchStatus(providerUrl) : { status: 0, type: "" };
    check(
      "the booking's provider can also read the superseded object",
      providerRead.status === 200,
      `HTTP ${providerRead.status}`,
    );
    const otherUrls = await signedCargoPhotoUrls(otherProvider.token, [priorPath]);
    check(
      "an unrelated provider cannot mint a URL for it",
      !otherUrls.get(priorPath ?? ""),
      "signed URL handed out",
    );
  }

  // ---- a reopen archives the decision it clears --------------------------
  const rejectionNote = "Seals not visible — re-shoot in better light.";
  const rejected = await reviewCargoPhoto(provider.token, {
    bookingId,
    decision: "rejected",
    note: rejectionNote,
  });
  check(
    "provider can reject the replacement",
    rejected.ok && rejected.value.booking.reviewStatus === "rejected",
    rejected.ok ? "" : rejected.message,
  );

  const reopened = await reopenCargoPhoto(provider.token, {
    bookingId,
    note: "Trader asked for another attempt.",
  });
  check(
    "reopening clears the decision and queues the photo again",
    reopened.ok && reopened.value.booking.reviewStatus === "pending",
    reopened.ok ? "" : reopened.message,
  );

  const afterReopen = await cargoPhotoHistory(trader.token, { bookingId });
  const cleared = afterReopen.ok
    ? afterReopen.value.find((entry) => entry.path === frameAPath)
    : undefined;
  check(
    "the reopened version is archived with the decision that was cleared",
    cleared?.reason === "reopened" &&
      cleared?.reviewStatus === "rejected" &&
      cleared?.reviewNote === rejectionNote,
    `reason=${cleared?.reason} status=${cleared?.reviewStatus} note=${cleared?.reviewNote}`,
  );
  check(
    "the archived decision names the reviewing provider",
    cleared?.reviewerName === provider.user.name,
    `${cleared?.reviewerName}`,
  );
  check(
    "the reopened photo is still the current one",
    reopened.ok && (await findBookingById(bookingId))?.cargoPhotoPath === cleared?.path,
  );
  const countAfterReopen = afterReopen.ok ? afterReopen.value.length : -1;
  check(
    "the reopen added exactly one archived version",
    countAfterReopen === archived.length + 1,
    `${archived.length} → ${countAfterReopen}`,
  );

  // ---- an object is never archived twice ---------------------------------
  const frameB = await submitCargoPhoto(trader.token, {
    bookingId,
    label: "History check — frame B",
    ...payload("public/logo-256.png"),
  });
  check("a second replacement is accepted", frameB.ok, frameB.ok ? "" : frameB.message);
  const afterSecond = await cargoPhotoHistory(trader.token, { bookingId });
  const reopenedEntry = afterSecond.ok
    ? afterSecond.value.find((e) => e.path === cleared?.path)
    : undefined;
  check(
    "replacing an already-archived version does not duplicate it",
    (afterSecond.ok ? afterSecond.value.length : -1) === countAfterReopen,
    `${countAfterReopen} → ${afterSecond.ok ? afterSecond.value.length : -1}`,
  );
  check(
    "the original decision survives the replacement",
    reopenedEntry?.reviewStatus === "rejected" && reopenedEntry?.reviewNote === rejectionNote,
    `status=${reopenedEntry?.reviewStatus} note=${reopenedEntry?.reviewNote}`,
  );

  // ---- an approval survives into the history -----------------------------
  const approved = await reviewCargoPhoto(provider.token, {
    bookingId,
    decision: "approved",
    note: "",
  });
  check("provider can approve", approved.ok, approved.ok ? "" : approved.message);
  const approvedPath = approved.ok ? approved.value.booking.cargoPhotoPath : null;
  await reopenCargoPhoto(provider.token, { bookingId, note: "" });
  const frameC = await submitCargoPhoto(trader.token, {
    bookingId,
    label: "History check — frame C (after approval)",
    ...payload("screenshots/stacking-fixed.png"),
  });
  check("a third replacement is accepted after the approval was reopened", frameC.ok);
  const afterThird = await cargoPhotoHistory(trader.token, { bookingId });
  check(
    "the replaced frame B is archived",
    (afterThird.ok ? afterThird.value.length : -1) ===
      (afterSecond.ok ? afterSecond.value.length : -1) + (frameC.ok ? 1 : 0),
  );
  const approvedEntry = afterThird.ok
    ? afterThird.value.find((entry) => entry.path === approvedPath)
    : undefined;
  check(
    "an approved version keeps its approval in the history",
    approvedEntry?.reviewStatus === "approved" &&
      approvedEntry?.reviewerName === provider.user.name,
    `status=${approvedEntry?.reviewStatus} reviewer=${approvedEntry?.reviewerName}`,
  );

  // ---- who may read the history -----------------------------------------
  const providerHistory = await cargoPhotoHistory(provider.token, { bookingId });
  check(
    "the provider reads the same history",
    providerHistory.ok &&
      providerHistory.value.length === (afterThird.ok ? afterThird.value.length : -1),
    providerHistory.ok ? "" : `${providerHistory.code}: ${providerHistory.message}`,
  );
  const adminHistory = await cargoPhotoHistory(admin.token, { bookingId });
  check("an admin can read it", adminHistory.ok, adminHistory.ok ? "" : adminHistory.message);
  const foreignTrader = await cargoPhotoHistory(otherTrader.token, { bookingId });
  check(
    "another trader is refused",
    !foreignTrader.ok && foreignTrader.code === "FORBIDDEN",
    foreignTrader.ok ? "granted" : foreignTrader.code,
  );
  const foreignProvider = await cargoPhotoHistory(otherProvider.token, { bookingId });
  check(
    "another provider is refused",
    !foreignProvider.ok && foreignProvider.code === "FORBIDDEN",
    foreignProvider.ok ? "granted" : foreignProvider.code,
  );
  const anon = await cargoPhotoHistory("not-a-token", { bookingId });
  check(
    "an invalid token is refused",
    !anon.ok && anon.code === "UNAUTHORIZED",
    anon.ok ? "granted" : anon.code,
  );
  const missing = await cargoPhotoHistory(trader.token, { bookingId: "bk-does-not-exist" });
  check("an unknown booking is not found", !missing.ok && missing.code === "NOT_FOUND");

  // ---- the review queue carries the compare count ------------------------
  const queue = await cargoReviewQueue(provider.token);
  const row = queue.ok ? queue.value.find((view) => view.booking.id === bookingId) : undefined;
  const expectedCount = afterThird.ok ? afterThird.value.length : -1;
  check(
    "the review-queue card knows how many earlier versions exist",
    row !== undefined && row.cargoPhotoHistoryCount >= expectedCount,
    `card=${row?.cargoPhotoHistoryCount} expected≥${expectedCount}`,
  );
  const pending = await cargoPendingCount(provider.token);
  check("the pending badge still counts the queue", pending.ok && pending.value >= 1);

  // ---- put the original photograph back ---------------------------------
  if (priorPath) {
    const urls = await signedCargoPhotoUrls(trader.token, [priorPath]);
    const url = urls.get(priorPath);
    if (!url) throw new Error("could not read the original photograph back");
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    const restored = await submitCargoPhoto(trader.token, {
      bookingId,
      label: priorLabel,
      contentType: contentTypeForPath(priorPath),
      dataBase64: bytes.toString("base64"),
    });
    check(
      "the original photograph can be uploaded back",
      restored.ok,
      restored.ok ? "" : restored.message,
    );
    const finalRow = await findBookingById(bookingId);
    check(
      "the booking ends up pending with a photograph again",
      finalRow?.reviewStatus === "pending" && finalRow.cargoPhotoPath !== null,
      `status=${finalRow?.reviewStatus}`,
    );
  }

  const finalHistory = await cargoPhotoHistory(trader.token, { bookingId });
  const entries = finalHistory.ok ? finalHistory.value : [];
  console.log(`booking: ${bookingId} (${target.container.label})`);
  console.log(`archived versions: ${entries.length}`);
  for (const entry of entries) {
    console.log(
      `  - ${entry.supersededAt} ${entry.label || "(no label)"} · ${entry.reason} · ${
        entry.reviewStatus ?? "no decision"
      }${entry.reviewNote ? ` · "${entry.reviewNote}"` : ""} · url=${entry.url ? "ok" : "missing"}`,
    );
  }

  if (failures.length > 0) {
    console.log(`\nFAILED ${failures.length}, passed ${passed}`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n✓ all ${passed} checks passed`);
}

void main();
