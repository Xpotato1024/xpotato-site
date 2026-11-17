import {
  mediaPolicy,
  assertMediaBudget,
  classifyContainer,
  type MediaKind,
} from "@xpotato/editor-core/policy";
import { inspectImage } from "@xpotato/editor-core/image-inspection";
import type { LocalMedia } from "../data/storage.js";
export async function hashBlob(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(Error("ENCODE_FAILED"))),
      type,
      quality,
    ),
  );
}
async function decode(file: Blob): Promise<{
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
}> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file),
      image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(Error("HEIC_CONVERSION_REQUIRED"));
        image.src = url;
      });
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(image, 0, 0, w, h),
        close: () => URL.revokeObjectURL(url),
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
}
export async function optimizeImage(
  file: File,
  draftId: string,
  assetId: string,
  kind: MediaKind,
): Promise<LocalMedia> {
  if (file.size <= 0 || file.size > mediaPolicy.inputBytes) throw Error("INPUT_BYTES_LIMIT");
  const input = new Uint8Array(await file.arrayBuffer()),
    container = classifyContainer(input),
    sourceSha256 = await hashBlob(file);
  if (container.mime !== "image/heic") container.animated = inspectImage(input, null).animated;
  let blob: Blob = new Blob([input], { type: container.mime }),
    transform = "identity-v1",
    finalKind = container.animated ? "animation" : kind;
  if (container.animated) {
    inspectImage(input, "animation");
    assertMediaBudget("animation", file.size);
  } else {
    if (kind === "animation") throw Error("ANIMATION_REQUIRED");
    if (container.mime !== "image/heic") inspectImage(input, kind);
    const image = await decode(new Blob([input], { type: container.mime }));
    try {
      if (
        image.width * image.height > mediaPolicy.maxPixels ||
        Math.max(image.width, image.height) > mediaPolicy.maxDimension
      )
        throw Error("MEDIA_DECODE_BUDGET");
      const scale =
        kind === "photo"
          ? Math.min(1, mediaPolicy.photo.maxEdge / Math.max(image.width, image.height))
          : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw Error("CANVAS_UNAVAILABLE");
      image.draw(context, canvas.width, canvas.height);
      if (kind === "photo") {
        const encoded = await canvasBlob(canvas, "image/webp", mediaPolicy.photo.quality);
        if (
          encoded.type === "image/webp" &&
          (encoded.size < file.size || container.mime === "image/heic")
        ) {
          blob = encoded;
          transform = "photo-webp-draft-v1";
        } else if (container.mime === "image/heic") {
          blob = await canvasBlob(canvas, "image/jpeg", 0.85);
          transform = "photo-jpeg-draft-v1";
        }
      } else if (container.mime === "image/heic") {
        blob = await canvasBlob(canvas, "image/png");
        transform = "technical-png-draft-v1";
      }
      canvas.width = canvas.height = 1;
    } finally {
      image.close();
    }
    assertMediaBudget(finalKind, blob.size);
    inspectImage(new Uint8Array(await blob.arrayBuffer()), finalKind);
  }
  return {
    id: crypto.randomUUID(),
    draftId,
    assetId,
    blob,
    originalBytes: file.size,
    sourceSha256,
    sha256: await hashBlob(blob),
    kind: finalKind,
    transform,
    createdAt: new Date().toISOString(),
    originalName: file.name,
    sourceRetained: transform === "identity-v1",
  };
}
