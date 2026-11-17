import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const libheif = require("libheif-js/wasm-bundle");
let images = [];
try {
  const { input, maxPixels, maxDimension } = workerData;
  images = new libheif.HeifDecoder().decode(new Uint8Array(input));
  if (!images.length || images.length > 64) throw Error("HEIC_IMAGE_SET_INVALID");
  const primary = images.filter((image) => image.is_primary());
  if (primary.length !== 1 && images.length !== 1) throw Error("HEIC_PRIMARY_IMAGE_REQUIRED");
  const image = primary[0] ?? images[0],
    width = image.get_width(),
    height = image.get_height();
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > maxDimension ||
    height > maxDimension ||
    width * height > maxPixels
  )
    throw Error("MEDIA_DECODE_BUDGET");
  const rgba = await new Promise((resolve, reject) =>
    image.display({ width, height, data: new Uint8ClampedArray(width * height * 4) }, (result) =>
      result ? resolve(result) : reject(Error("HEIC_DECODE_FAILED")),
    ),
  );
  const bytes = new Uint8Array(
    rgba.data.buffer,
    rgba.data.byteOffset,
    rgba.data.byteLength,
  ).slice();
  parentPort.postMessage(
    { ok: true, width, height, data: bytes.buffer, decoder: "libheif-wasm-1.23.5" },
    [bytes.buffer],
  );
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error:
      error instanceof Error && /^[A-Z][A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : "HEIC_DECODE_FAILED",
  });
} finally {
  for (const image of images) image.free();
}
