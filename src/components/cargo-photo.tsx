import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, ImageOff, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill, type Tone } from "@/components/module-kit";
import {
  CARGO_REVIEW_LABELS,
  MODE_LABELS,
  type BookingView,
  type CargoReviewStatus,
} from "@/domain/types";
import {
  announceCargoChange,
  reopenCargoPhoto,
  reviewCargoPhoto,
  submitCargoPhoto,
} from "@/lib/api";
import { formatBytes, prepareCargoPhoto } from "@/lib/image";
import { cn } from "@/lib/utils";

const REVIEW_TONE: Record<CargoReviewStatus, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

/** Compact status chip used in tables and cards. */
export function CargoPhotoPill({ status }: { status: CargoReviewStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <ImageOff className="size-3" /> No photo
      </span>
    );
  }
  return <StatusPill label={CARGO_REVIEW_LABELS[status]} tone={REVIEW_TONE[status]} />;
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * One dialog for both sides of the workflow: the trader uploads or replaces the
 * photo, the provider approves or rejects it. Visibility is decided by props;
 * the server re-checks every permission regardless.
 */
export function CargoPhotoDialog({
  view,
  token,
  open,
  onOpenChange,
  canUpload,
  canReview,
  onChanged,
}: {
  view: BookingView;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpload: boolean;
  canReview: boolean;
  /** Called with the booking's new review status so the host can react to it. */
  onChanged: (status: CargoReviewStatus | null) => void;
}) {
  const { booking, lane, container, traderName, providerName } = view;
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(booking.cargoPhotoLabel ?? "");
  const [staged, setStaged] = useState<{ dataUrl: string; bytes: number } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "approve" | "reject" | "reopen" | null>(null);

  const uploadLocked =
    booking.status === "cancelled" ||
    booking.status === "delivered" ||
    booking.reviewStatus === "approved";

  async function onPickFile(file: File | null) {
    if (!file) return;
    setError(null);
    if (label.trim().length < 2) setLabel(file.name.replace(/\.[^.]+$/, "").slice(0, 80));
    const prepared = await prepareCargoPhoto(file);
    if (!prepared.ok) {
      setStaged(null);
      setError(prepared.message);
      return;
    }
    setStaged({ dataUrl: prepared.photo.dataUrl, bytes: prepared.photo.bytes });
  }

  async function upload() {
    if (!staged) {
      setError("Choose a photograph first.");
      return;
    }
    if (label.trim().length < 2) {
      setError("Add a short label describing the cargo.");
      return;
    }
    setBusy("upload");
    setError(null);
    const result = await submitCargoPhoto({
      token,
      bookingId: booking.id,
      label: label.trim(),
      contentType: "image/jpeg",
      dataBase64: staged.dataUrl,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStaged(null);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Cargo photo submitted for provider review.");
    announceCargoChange();
    onChanged(result.value.booking.reviewStatus);
  }

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision === "approved" ? "approve" : "reject");
    setError(null);
    const result = await reviewCargoPhoto({ token, bookingId: booking.id, decision, note });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNote("");
    toast.success(decision === "approved" ? "Cargo photo approved." : "Cargo photo rejected.");
    announceCargoChange();
    onChanged(result.value.booking.reviewStatus);
  }

  async function reopen() {
    setBusy("reopen");
    setError(null);
    const result = await reopenCargoPhoto({ token, bookingId: booking.id, note });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNote("");
    toast.success("Photo reopened — the trader can now resubmit it.");
    announceCargoChange();
    onChanged(result.value.booking.reviewStatus);
  }

  const previewSrc = staged?.dataUrl ?? view.cargoPhotoUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Camera className="size-4 text-primary" />
            Cargo photo
            <CargoPhotoPill status={booking.reviewStatus} />
          </DialogTitle>
          <DialogDescription>
            {lane.origin} → {lane.destination} · {container.label} · {MODE_LABELS[lane.mode]} ·{" "}
            <span className="font-mono">{booking.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/40">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={booking.cargoPhotoLabel ?? "Cargo photograph"}
                className="aspect-[4/3] w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
                <ImageOff className="size-6" />
                {booking.cargoPhotoPath
                  ? "Photo preview unavailable — reopen the dialog to refresh the link."
                  : "No photograph attached to this booking."}
              </div>
            )}
          </div>

          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Label</dt>
              <dd className="font-medium">{booking.cargoPhotoLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{canReview ? "Trader" : "Provider"}</dt>
              <dd>{canReview ? traderName : providerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Submitted</dt>
              <dd>{formatWhen(booking.cargoPhotoUploadedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">File</dt>
              <dd>{formatBytes(booking.cargoPhotoBytes)} · JPEG/PNG/WebP, private storage</dd>
            </div>
            {booking.reviewedAt ? (
              <div>
                <dt className="text-xs text-muted-foreground">Reviewed</dt>
                <dd>
                  {formatWhen(booking.reviewedAt)}
                  {view.reviewerName ? ` · ${view.reviewerName}` : ""}
                </dd>
              </div>
            ) : null}
            {booking.reviewStatus === "rejected" && booking.reviewNote ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5">
                <dt className="text-xs font-medium text-destructive">Rejection note</dt>
                <dd className="text-destructive">{booking.reviewNote}</dd>
              </div>
            ) : null}
            {booking.reviewStatus === "rejected"
              ? "Replace the photograph below to resubmit it for review."
              : null}
          </dl>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {canUpload ? (
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">
              {booking.cargoPhotoPath ? "Replace photograph" : "Upload photograph"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG or WebP. Large photos are downscaled to 1600 px and kept under 3 MB. Stored
              privately; only this booking&apos;s trader, provider and administrators can open it.
            </p>
            {uploadLocked ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {booking.reviewStatus === "approved"
                  ? "This photograph is approved and can no longer be replaced."
                  : "This booking is closed, so its photograph can no longer be changed."}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`cargo-label-${booking.id}`}>Cargo label</Label>
                  <Input
                    id={`cargo-label-${booking.id}`}
                    value={label}
                    maxLength={120}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Palletised textile rolls, 6 crates"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cargo-file-${booking.id}`}>Photograph</Label>
                  <Input
                    id={`cargo-file-${booking.id}`}
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
                  />
                  {staged ? (
                    <p className="text-xs text-muted-foreground">
                      Ready to upload · {formatBytes(staged.bytes)} after compression
                    </p>
                  ) : null}
                </div>
                <Button size="sm" disabled={busy !== null || !staged} onClick={() => void upload()}>
                  {busy === "upload" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {booking.cargoPhotoPath ? "Replace and resubmit" : "Upload for review"}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {canReview && booking.reviewStatus !== null && booking.reviewStatus !== "pending" ? (
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">Reopen for review</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clears the current decision so the trader can upload a new photograph. The existing
              image stays attached until they replace it.
            </p>
            <div className="mt-3 space-y-2">
              <Label htmlFor={`cargo-reopen-${booking.id}`}>Reason (optional)</Label>
              <Textarea
                id={`cargo-reopen-${booking.id}`}
                value={note}
                maxLength={400}
                rows={2}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. The seals are not visible — please re-shoot in better light."
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void reopen()}
              >
                {busy === "reopen" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Reopen for review
              </Button>
            </div>
          </div>
        ) : null}

        {canReview && booking.reviewStatus === "pending" ? (
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">Provider decision</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approving or rejecting only records the photo decision — it never changes the booking
              status or reserved capacity.
            </p>
            <div className="mt-3 space-y-2">
              <Label htmlFor={`cargo-note-${booking.id}`}>Note (required to reject)</Label>
              <Textarea
                id={`cargo-note-${booking.id}`}
                value={note}
                maxLength={400}
                rows={2}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Photograph is blurred — send a clear shot of the sealed crates."
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => void decide("approved")}>
                  {busy === "approve" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("text-destructive")}
                  disabled={busy !== null}
                  onClick={() => void decide("rejected")}
                >
                  {busy === "reject" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {booking.cargoPhotoPath ? (
            <p className="mr-auto text-xs text-muted-foreground">
              Review is advisory: bookings stay bookable, cancellable and deliverable while a photo
              awaits review.
            </p>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
