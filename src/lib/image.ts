/**
 * Browser-side preparation of a cargo photograph.
 *
 * Phones produce 4–8 MB photos, while server-function bodies (and the bucket)
 * cap at a few MB, so the image is downscaled and re-encoded before it leaves
 * the device. The server independently re-checks the real image signature and
 * size — this module only makes uploads practical, it is not the authority.
 */

export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 1600 px on the long edge keeps cargo labels readable without huge files. */
const MAX_EDGE = 1600;
const QUALITY_STEPS = [0.86, 0.74, 0.62];

export type PreparedPhoto = {
  dataUrl: string;
  contentType: "image/jpeg";
  bytes: number;
  width: number;
  height: number;
};

export type PrepareFailure = { message: string };

function base64Bytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

export async function prepareCargoPhoto(
  file: File,
): Promise<{ ok: true; photo: PreparedPhoto } | { ok: false; message: string }> {
  if (!(ACCEPTED_SOURCE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Choose a JPEG, PNG or WebP image." };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, message: "That image is larger than 12 MB. Choose a smaller photograph." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, message: "That file could not be opened as an image." };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { ok: false, message: "This browser cannot prepare images for upload." };
  }
  // White backdrop: JPEG has no alpha, so transparent PNGs would otherwise go black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const bytes = base64Bytes(dataUrl);
    if (bytes <= MAX_UPLOAD_BYTES) {
      return { ok: true, photo: { dataUrl, contentType: "image/jpeg", bytes, width, height } };
    }
  }

  return {
    ok: false,
    message: "That image is still above 3 MB after compression. Try a smaller photograph.",
  };
}

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
