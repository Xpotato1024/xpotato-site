import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { contentIdSchema } from "@xpotato/content-contracts/common";
import {
  mediaHandoffManifest,
  mediaHandoffPolicy,
  parseMediaHandoff,
  type MediaHandoffManifest,
  type PreparedHandoffMedia,
} from "@xpotato/editor-core/media-handoff";
import { inspectImage, type ImageInspection } from "@xpotato/editor-core/image-inspection";
import { draftPath } from "@xpotato/editor-core/draft";
import { mediaPolicy } from "@xpotato/editor-core/policy";
import { animationPlaybackFingerprint, inspectAnimationBytes } from "@xpotato/media-ingest";
import {
  createEditorHandoffClient,
  registrationFailureCode,
  type EditorHandoffClient,
  type HandoffAsset,
  type HandoffSnapshot,
} from "./register-editor-handoff-client.js";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
interface CheckedAsset {
  assetId: string;
  metadata: PreparedHandoffMedia["metadata"];
  bytes: Uint8Array;
  inspection: ImageInspection;
}
export interface EditorHandoffReceipt {
  schemaVersion: 1;
  protocol: "xpotato-private-draft-media-receipt-v1";
  repository: string;
  source: MediaHandoffManifest["source"];
  draftId: string;
  draftRevision: number;
  mode: "register" | "verify";
  registered: number;
  reused: number;
  verified: true;
  verifiedAt: string;
  assets: { assetId: string; remoteId: string; sha256: string; bytes: number; verified: true }[];
}

async function privateInput(path: string): Promise<Uint8Array> {
  const before = await lstat(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1 ||
    before.size <= 0 ||
    before.size > mediaHandoffPolicy.bundleBytes ||
    (await realpath(path)) !== path
  ) {
    throw Error("EDITOR_CLI_INPUT_INVALID");
  }
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await file.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1) {
      throw Error("EDITOR_CLI_INPUT_CHANGED");
    }
    const pieces: Buffer[] = [];
    let length = 0;
    while (true) {
      const piece = Buffer.alloc(64 * 1024);
      const { bytesRead } = await file.read(piece);
      if (!bytesRead) break;
      length += bytesRead;
      if (length > mediaHandoffPolicy.bundleBytes) {
        throw Error("MEDIA_HANDOFF_BYTES_LIMIT");
      }
      pieces.push(piece.subarray(0, bytesRead));
    }
    const after = await file.stat();
    if (
      length !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      after.nlink !== 1
    ) {
      throw Error("EDITOR_CLI_INPUT_CHANGED");
    }
    return Buffer.concat(pieces, length);
  } finally {
    await file.close();
  }
}

function decodeBase64(encoded: string, size: number, expectedHash: string): Uint8Array {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded || bytes.length !== size || hash(bytes) !== expectedHash) {
    throw Error("MEDIA_HANDOFF_IMAGE_HASH_MISMATCH");
  }
  return bytes;
}

/** Check actual WebP bitstreams; a declared lossy:false does not establish lossless encoding. */
function assertLosslessWebp(bytes: Uint8Array, expectedFrames: number): void {
  const data = Buffer.from(bytes);
  let losslessFrames = 0;
  const chunks = (start: number, end: number) => {
    let offset = start;
    while (offset < end) {
      if (offset + 8 > end) throw Error("MEDIA_CONTAINER_INVALID");
      const kind = data.subarray(offset, offset + 4).toString("ascii");
      const size = data.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (body + size > end) throw Error("MEDIA_CONTAINER_INVALID");
      if (kind === "VP8 ") throw Error("MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID");
      if (kind === "VP8L") losslessFrames++;
      if (kind === "ANMF") {
        if (size < 16 || start !== 12) throw Error("MEDIA_CONTAINER_INVALID");
        chunks(body + 16, body + size);
      }
      offset = body + size + (size % 2);
    }
    if (offset !== end) throw Error("MEDIA_CONTAINER_INVALID");
  };
  chunks(12, bytes.length);
  if (losslessFrames !== expectedFrames) {
    throw Error("MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID");
  }
}

async function decodeImage(bytes: Uint8Array, inspection: ImageInspection): Promise<void> {
  try {
    const image = sharp(bytes, {
      animated: inspection.animated,
      limitInputPixels: mediaPolicy.maxPixels,
      failOn: "error",
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== "webp" ||
      metadata.width !== inspection.width ||
      (metadata.pageHeight ?? metadata.height) !== inspection.height ||
      (metadata.pages ?? 1) !== inspection.frames
    ) {
      throw Error("MEDIA_HANDOFF_METADATA_MISMATCH");
    }
    if (metadata.exif || metadata.xmp || metadata.iptc || metadata.orientation) {
      throw Error("DRAFT_PRIVATE_METADATA_RETAINED");
    }
    await image.stats();
  } catch (error) {
    const code = registrationFailureCode(error);
    throw Error(code === "EDITOR_CLI_REGISTRATION_FAILED" ? "MEDIA_HANDOFF_IMAGE_INVALID" : code);
  }
}

async function checkedAssets(value: unknown) {
  const bundle = parseMediaHandoff(value);
  const assets: CheckedAsset[] = [];
  for (const entry of bundle.assets) {
    const metadata = entry.prepared.metadata;
    const bytes = decodeBase64(entry.prepared.masterBase64, metadata.bytes, metadata.sha256);
    const preview = decodeBase64(
      entry.prepared.previewBase64,
      metadata.previewBytes,
      metadata.previewSha256,
    );
    const inspection = inspectImage(bytes, metadata.kind);
    const previewInspection = inspectImage(preview, null);
    if (
      inspection.mime !== metadata.mime ||
      inspection.width !== metadata.width ||
      inspection.height !== metadata.height ||
      previewInspection.mime !== "image/webp" ||
      previewInspection.animated
    ) {
      throw Error("MEDIA_HANDOFF_METADATA_MISMATCH");
    }
    if (metadata.kind !== "photo") assertLosslessWebp(bytes, inspection.frames);
    await decodeImage(bytes, inspection);
    await decodeImage(preview, previewInspection);
    if (metadata.kind === "animation") {
      if (!metadata.animation || !metadata.playbackSha256) {
        throw Error("MEDIA_HANDOFF_METADATA_MISMATCH");
      }
      const animation = await inspectAnimationBytes(bytes, {
        frameCount: metadata.animation.frameCount,
        loop: metadata.animation.loop,
        delaysMs: metadata.animation.delaysMs,
      });
      if (
        animation.animation.frameCount !== inspection.frames ||
        metadata.animation.durationMs !== inspection.durationMs ||
        (await animationPlaybackFingerprint(Buffer.from(bytes))) !== metadata.playbackSha256
      ) {
        throw Error("MEDIA_HANDOFF_METADATA_MISMATCH");
      }
    } else if (metadata.animation !== undefined || metadata.playbackSha256 !== undefined) {
      throw Error("MEDIA_HANDOFF_METADATA_MISMATCH");
    }
    assets.push({ assetId: entry.assetId, metadata, bytes, inspection });
  }
  return { manifest: mediaHandoffManifest(bundle), assets };
}

function assertSnapshot(snapshot: HandoffSnapshot, manifest: MediaHandoffManifest): void {
  if (
    !object(snapshot) ||
    snapshot.repository !== manifest.repository ||
    !object(snapshot.source) ||
    !Array.isArray(snapshot.assets) ||
    ["contentId", "branch", "commit", "path", "sha256"].some(
      (key) => snapshot.source[key as keyof typeof snapshot.source] !== manifest.source[key as keyof typeof manifest.source],
    )
  ) {
    throw Error("MEDIA_HANDOFF_SOURCE_MISMATCH");
  }
  const draft = snapshot.draft;
  if (draft === null) {
    if (snapshot.assets.length) throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
    return;
  }
  if (
    !object(draft) ||
    !contentIdSchema.safeParse(draft.id).success ||
    draft.contentId !== manifest.source.contentId ||
    draft.branch !== manifest.source.branch ||
    (draft.sourcePath ?? draftPath(draft.contentId)) !== manifest.source.path ||
    draft.state === "deleted" ||
    !Number.isSafeInteger(draft.revision) ||
    draft.revision < 0 ||
    !object(draft.assets)
  ) {
    throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
  }
}

function activeAsset(snapshot: HandoffSnapshot, assetId: string): HandoffAsset | undefined {
  const id = snapshot.draft?.assets[assetId];
  if (!id) return undefined;
  const found = snapshot.assets.filter((asset) => asset?.id === id);
  const asset = found[0];
  if (
    found.length !== 1 ||
    !asset ||
    !contentIdSchema.safeParse(asset.id).success ||
    asset.draftId !== snapshot.draft?.id ||
    asset.assetId !== assetId ||
    asset.status !== "staged"
  ) {
    throw Error("DRAFT_MEDIA_REFERENCE_INVALID");
  }
  return asset;
}

function assertPreimages(snapshot: HandoffSnapshot, manifest: MediaHandoffManifest): void {
  assertSnapshot(snapshot, manifest);
  for (const entry of manifest.assets) {
    const current = activeAsset(snapshot, entry.assetId);
    if (
      current?.sha256 !== entry.metadata.sha256 &&
      current?.sha256 !== entry.expectedRemoteSha256
    ) {
      throw Error("MEDIA_HANDOFF_REMOTE_CONFLICT");
    }
  }
}

function assertAsset(asset: HandoffAsset | undefined, expected: CheckedAsset, draftId: string): asserts asset is HandoffAsset {
  if (
    !asset ||
    !contentIdSchema.safeParse(asset.id).success ||
    asset.draftId !== draftId ||
    asset.assetId !== expected.assetId ||
    asset.status !== "staged" ||
    asset.sha256 !== expected.metadata.sha256 ||
    asset.bytes !== expected.bytes.length ||
    asset.mime !== expected.inspection.mime ||
    asset.kind !== expected.metadata.kind ||
    asset.width !== expected.inspection.width ||
    asset.height !== expected.inspection.height ||
    asset.frames !== expected.inspection.frames ||
    asset.durationMs !== expected.inspection.durationMs
  ) {
    throw Error("MEDIA_HANDOFF_READBACK_FAILED");
  }
}

function within(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

async function receiptPath(root: string, path: string): Promise<string> {
  const target = resolve(root, path);
  if (
    !within(resolve(root, ".local"), target) &&
    !(within(resolve(process.env.RUNNER_TEMP ?? tmpdir()), target) && !within(root, target))
  ) {
    throw Error("EDITOR_CLI_RECEIPT_PATH_INVALID");
  }
  await mkdir(dirname(target), { recursive: true });
  if ((await realpath(dirname(target))) !== dirname(target)) {
    throw Error("EDITOR_CLI_RECEIPT_PATH_INVALID");
  }
  try {
    await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return target;
    throw Error("EDITOR_CLI_RECEIPT_PATH_INVALID");
  }
  throw Error("EDITOR_CLI_RECEIPT_EXISTS");
}

export async function registerEditorHandoff(
  options: { input: string; verifyOnly?: boolean; receipt?: string; root?: string },
  ports: { client?: EditorHandoffClient; now?: () => number } = {},
): Promise<EditorHandoffReceipt> {
  const root = resolve(options.root ?? ".");
  const input = await privateInput(resolve(root, options.input));
  const { manifest, assets } = await checkedAssets(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input)),
  );
  const output = options.receipt ? await receiptPath(root, options.receipt) : undefined;
  const client = ports.client ?? createEditorHandoffClient();
  let snapshot = await client.inspect(manifest, "inspect");
  assertPreimages(snapshot, manifest);
  if (options.verifyOnly && assets.some((entry) => activeAsset(snapshot, entry.assetId)?.sha256 !== entry.metadata.sha256)) {
    throw Error("MEDIA_HANDOFF_IMAGES_MISSING");
  }
  if (!snapshot.draft) {
    snapshot = await client.inspect(manifest, "create");
    assertPreimages(snapshot, manifest);
    if (!snapshot.draft) throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
  }
  const draftId = snapshot.draft.id;
  const verified = new Map<string, string>();
  let registered = 0;
  let reused = 0;
  const verify = async (asset: HandoffAsset | undefined, entry: CheckedAsset) => {
    assertAsset(asset, entry, draftId);
    const bytes = await client.read(asset.id, entry.bytes.length);
    if (bytes.length !== entry.bytes.length || hash(bytes) !== entry.metadata.sha256) {
      throw Error("MEDIA_HANDOFF_READBACK_FAILED");
    }
    return asset;
  };
  const inspect = async () => {
    const latest = await client.inspect(manifest, "inspect");
    assertPreimages(latest, manifest);
    if (latest.draft?.id !== draftId) throw Error("DRAFT_MEDIA_IDENTITY_MISMATCH");
    for (const [assetId, remoteId] of verified) {
      const asset = activeAsset(latest, assetId);
      if (asset?.id !== remoteId) {
        throw Error("MEDIA_HANDOFF_REMOTE_CONFLICT");
      }
      assertAsset(asset, assets.find((entry) => entry.assetId === assetId)!, draftId);
    }
    return latest;
  };
  for (const entry of assets) {
    let asset = activeAsset(snapshot, entry.assetId);
    const reuse = asset?.sha256 === entry.metadata.sha256;
    if (!reuse) {
      if (options.verifyOnly) throw Error("MEDIA_HANDOFF_IMAGES_MISSING");
      const reservation = await client.reserve({
        manifest,
        draftId,
        expectedDraftRevision: snapshot.draft!.revision,
        assetId: entry.assetId,
      });
      if (!contentIdSchema.safeParse(reservation?.id).success) {
        throw Error("EDITOR_CLI_RESPONSE_INVALID");
      }
      asset = await client.upload(reservation.id, entry.bytes);
    }
    asset = await verify(asset, entry);
    verified.set(entry.assetId, asset.id);
    if (reuse) reused++;
    else registered++;
    snapshot = await inspect();
  }
  // Read every object again and recheck the active references before declaring the set complete.
  for (const entry of assets) await verify(activeAsset(snapshot, entry.assetId), entry);
  snapshot = await inspect();
  const receipt: EditorHandoffReceipt = {
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-receipt-v1",
    repository: manifest.repository,
    source: { ...manifest.source },
    draftId,
    draftRevision: snapshot.draft!.revision,
    mode: options.verifyOnly ? "verify" : "register",
    registered,
    reused,
    verified: true,
    verifiedAt: new Date((ports.now ?? Date.now)()).toISOString(),
    assets: assets.map((entry) => ({
      assetId: entry.assetId,
      remoteId: verified.get(entry.assetId)!,
      sha256: entry.metadata.sha256,
      bytes: entry.bytes.length,
      verified: true,
    })),
  };
  if (output) {
    try {
      if ((await realpath(dirname(output))) !== dirname(output)) {
        throw Error("OUTPUT_DIRECTORY_CHANGED");
      }
      await writeFile(output, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 });
    } catch {
      throw Error("EDITOR_CLI_RECEIPT_WRITE_FAILED");
    }
  }
  return receipt;
}

export function parseRegistrationArguments(args: string[]) {
  let input: string | undefined;
  let receipt: string | undefined;
  let verifyOnly = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (!["--input", "--receipt", "--verify-only"].includes(flag) || seen.has(flag)) {
      throw Error("EDITOR_CLI_ARGUMENTS_INVALID");
    }
    seen.add(flag);
    if (flag === "--verify-only") {
      verifyOnly = true;
      continue;
    }
    const value = args[++index];
    if (!value || value.startsWith("--")) throw Error("EDITOR_CLI_ARGUMENTS_INVALID");
    if (flag === "--input") input = value;
    else receipt = value;
  }
  if (!input) throw Error("EDITOR_CLI_ARGUMENTS_INVALID");
  return { input, verifyOnly, ...(receipt ? { receipt } : {}) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await registerEditorHandoff(parseRegistrationArguments(process.argv.slice(2)))));
  } catch (error) {
    console.error(registrationFailureCode(error));
    process.exitCode = 1;
  }
}
