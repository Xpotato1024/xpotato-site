import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mediaHandoffPolicy, type MediaHandoffManifest } from "@xpotato/editor-core/media-handoff";
import type { AssetRecord, DraftRecord } from "../../apps/editor-api/src/state.js";

export const editorHandoffApi = "https://xpotato.net/editor-api/cli";
export type HandoffAsset = Omit<AssetRecord, "key">;
export interface HandoffSnapshot {
  repository: string;
  source: MediaHandoffManifest["source"];
  draft: DraftRecord | null;
  assets: HandoffAsset[];
}
export interface EditorHandoffClient {
  inspect(manifest: MediaHandoffManifest, mode: "inspect" | "create"): Promise<HandoffSnapshot>;
  reserve(input: {
    manifest: MediaHandoffManifest;
    draftId: string;
    expectedDraftRevision: number;
    assetId: string;
  }): Promise<{ id: string }>;
  upload(id: string, bytes: Uint8Array): Promise<HandoffAsset>;
  read(id: string, maximum: number): Promise<Uint8Array>;
}

const safeCodes = new Set([
  "EDITOR_CLI_ARGUMENTS_INVALID",
  "EDITOR_CLI_GH_AUTH_REQUIRED",
  "EDITOR_CLI_AUTH_RECONNECT_REQUIRED",
  "EDITOR_CLI_NETWORK_FAILED",
  "EDITOR_CLI_REDIRECT_REJECTED",
  "EDITOR_CLI_RESPONSE_INVALID",
  "EDITOR_CLI_RESPONSE_TOO_LARGE",
  "EDITOR_CLI_API_REQUEST_FAILED",
  "EDITOR_CLI_INPUT_INVALID",
  "EDITOR_CLI_INPUT_CHANGED",
  "EDITOR_CLI_RECEIPT_PATH_INVALID",
  "EDITOR_CLI_RECEIPT_EXISTS",
  "EDITOR_CLI_RECEIPT_WRITE_FAILED",
  "EDITOR_CLI_REGISTRATION_FAILED",
  "CLI_AUTH_CHANNEL_INVALID",
  "CLI_AUTH_NOT_CONFIGURED",
  "CLI_AUTH_UNAVAILABLE",
  "CLI_AUTH_REDIRECT",
  "CLI_GIT_UNAVAILABLE",
  "CLI_OWNER_ONLY",
  "CLI_REPOSITORY_FORBIDDEN",
  "AUTH_NOT_CONFIGURED",
  "MEDIA_HANDOFF_INVALID",
  "MEDIA_HANDOFF_MANIFEST_INVALID",
  "MEDIA_HANDOFF_MANIFEST_BYTES_LIMIT",
  "MEDIA_HANDOFF_ANIMATION_INVALID",
  "MEDIA_HANDOFF_PREPARED_INVALID",
  "MEDIA_HANDOFF_SOURCE_INVALID",
  "MEDIA_HANDOFF_SOURCE_MISMATCH",
  "MEDIA_HANDOFF_SOURCE_HASH_MISMATCH",
  "MEDIA_HANDOFF_REFERENCES_MISMATCH",
  "MEDIA_HANDOFF_ASSET_INVALID",
  "MEDIA_HANDOFF_DUPLICATE_ASSET",
  "MEDIA_HANDOFF_BYTES_LIMIT",
  "MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID",
  "MEDIA_HANDOFF_HEAD_CHANGED",
  "MEDIA_HANDOFF_REMOTE_CONFLICT",
  "MEDIA_HANDOFF_REMOTE_INVALID",
  "MEDIA_HANDOFF_REPOSITORY_MISMATCH",
  "MEDIA_HANDOFF_ALREADY_REGISTERED",
  "MEDIA_HANDOFF_METADATA_MISMATCH",
  "MEDIA_HANDOFF_IMAGE_INVALID",
  "MEDIA_HANDOFF_IMAGE_HASH_MISMATCH",
  "MEDIA_HANDOFF_READBACK_FAILED",
  "MEDIA_HANDOFF_IMAGES_MISSING",
  "DRAFT_MEDIA_IDENTITY_MISMATCH",
  "DRAFT_MEDIA_AMBIGUOUS",
  "DRAFT_MEDIA_REFERENCE_INVALID",
  "DRAFT_CONFLICT",
  "STATE_CONFLICT",
  "DRAFT_QUOTA_EXCEEDED",
  "DRAFT_NOT_FOUND",
  "UPLOAD_EXPIRED",
  "UPLOAD_BUSY",
  "UPLOAD_SIZE_MISMATCH",
  "UPLOAD_HASH_MISMATCH",
  "UPLOAD_CONCURRENCY_LIMIT",
  "MEDIA_TYPE_MISMATCH",
  "MEDIA_READBACK_FAILED",
  "MEDIA_BYTES_LIMIT",
  "MEDIA_CONTAINER_INVALID",
  "MEDIA_DECODE_BUDGET",
  "MEDIA_FORMAT_UNSUPPORTED",
  "ANIMATION_FRAME_LIMIT",
  "ANIMATION_PROFILE_REQUIRED",
  "ANIMATION_REQUIRED",
  "ANIMATION_TIMING_CHANGED",
  "ANIMATION_PLAYBACK_CHANGED",
  "ANIMATION_PROFILE_INVALID",
  "DRAFT_PRIVATE_METADATA_RETAINED",
]);

/** Only repository-owned codes reach stdout/stderr; transport bodies and child errors never do. */
export function registrationFailureCode(error: unknown): string {
  return error instanceof Error && safeCodes.has(error.message)
    ? error.message
    : "EDITOR_CLI_REGISTRATION_FAILED";
}

export interface GitHubTokenCommand {
  (
    executable: string,
    args: string[],
    options: { encoding: "utf8"; timeout: number; maxBuffer: number; windowsHide: boolean },
  ): Promise<{ stdout: string }>;
}
const runFile = promisify(execFile);

export async function readGitHubCliToken(
  run: GitHubTokenCommand = async (executable, args, options) => runFile(executable, args, options),
): Promise<string> {
  try {
    const result = await run("gh", ["auth", "token", "--hostname", "github.com"], {
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 16 * 1024,
      windowsHide: true,
    });
    const token = result.stdout.trim();
    if (!/^[A-Za-z0-9_.-]{16,4096}$/u.test(token)) {
      throw Error("INVALID_GH_OUTPUT");
    }
    return token;
  } catch {
    // execFile errors may include child stdout/stderr, including the credential.
    throw Error("EDITOR_CLI_GH_AUTH_REQUIRED");
  }
}

async function boundedResponse(response: Response, maximum: number): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/u.test(declared) && Number(declared) > maximum) {
    await response.body?.cancel();
    throw Error("EDITOR_CLI_RESPONSE_TOO_LARGE");
  }
  if (!response.body) {
    throw Error("EDITOR_CLI_RESPONSE_INVALID");
  }
  const reader = response.body.getReader();
  const pieces: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > maximum) {
        await reader.cancel();
        throw Error("EDITOR_CLI_RESPONSE_TOO_LARGE");
      }
      pieces.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    bytes.set(piece, offset);
    offset += piece.length;
  }
  return bytes;
}

export function createEditorHandoffClient(
  ports: { fetch?: typeof fetch; readToken?: () => Promise<string> } = {},
): EditorHandoffClient {
  const fetcher = ports.fetch ?? fetch;
  const readToken = ports.readToken ?? readGitHubCliToken;
  let credential: Promise<string> | undefined;

  async function request(route: string, options: RequestInit = {}): Promise<Response> {
    credential ??= readToken();
    let token: string;
    try {
      token = await credential;
      if (!/^[A-Za-z0-9_.-]{16,4096}$/u.test(token)) {
        throw Error("INVALID_GH_OUTPUT");
      }
    } catch {
      throw Error("EDITOR_CLI_GH_AUTH_REQUIRED");
    }
    let response: Response;
    try {
      const headers = new Headers(options.headers);
      headers.set("Authorization", "Bearer " + token);
      response = await fetcher(editorHandoffApi + route, {
        ...options,
        headers,
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw Error("EDITOR_CLI_NETWORK_FAILED");
    }
    if (
      (response.status >= 300 && response.status < 400) ||
      response.redirected ||
      (response.url && response.url !== editorHandoffApi + route)
    ) {
      await response.body?.cancel();
      throw Error("EDITOR_CLI_REDIRECT_REJECTED");
    }
    if (response.status === 401) {
      await response.body?.cancel();
      throw Error("EDITOR_CLI_AUTH_RECONNECT_REQUIRED");
    }
    if (!response.ok) {
      let code: unknown;
      try {
        const bytes = await boundedResponse(response, mediaHandoffPolicy.manifestBytes);
        code = (JSON.parse(new TextDecoder().decode(bytes)) as { error?: unknown }).error;
      } catch {
        throw Error("EDITOR_CLI_API_REQUEST_FAILED");
      }
      throw Error(
        typeof code === "string" && safeCodes.has(code)
          ? code
          : "EDITOR_CLI_API_REQUEST_FAILED",
      );
    }
    return response;
  }

  async function json<T>(route: string, body?: unknown, bytes?: Uint8Array): Promise<T> {
    const payload = bytes ? Uint8Array.from(bytes).buffer : JSON.stringify(body);
    if (payload === undefined) {
      throw Error("EDITOR_CLI_RESPONSE_INVALID");
    }
    const response = await request(route, {
      method: bytes ? "PUT" : "POST",
      headers: { "Content-Type": bytes ? "image/webp" : "application/json" },
      body: payload,
    });
    try {
      return JSON.parse(
        new TextDecoder().decode(
          await boundedResponse(response, mediaHandoffPolicy.manifestBytes * 4),
        ),
      ) as T;
    } catch (error) {
      if (error instanceof Error && error.message === "EDITOR_CLI_RESPONSE_TOO_LARGE") {
        throw error;
      }
      throw Error("EDITOR_CLI_RESPONSE_INVALID");
    }
  }

  return {
    inspect: (manifest, mode) => json("/media-handoff", { manifest, mode }),
    reserve: (input) => json("/media/reserve", input),
    upload: (id, bytes) => json("/media/upload/" + encodeURIComponent(id), undefined, bytes),
    read: async (id, maximum) => {
      const response = await request("/media/" + encodeURIComponent(id));
      try {
        return await boundedResponse(response, maximum);
      } catch {
        throw Error("MEDIA_HANDOFF_READBACK_FAILED");
      }
    },
  };
}
