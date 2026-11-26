import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { draftPath } from "@xpotato/editor-core/draft";
import { GitError, GitRepository, type GitRequest } from "@xpotato/editor-core/git";
import type { MediaHandoffManifest } from "@xpotato/editor-core/media-handoff";
import { authenticateCLI, type CLIPrincipal } from "./cli-auth.js";
import { seal } from "./auth.js";
import { createDraftRecord, editDraftState, reserveMedia } from "./media.js";
import { DraftStore, stateKey, type AssetRecord, type DraftRecord, type Reservation } from "./state.js";
import { MemoryBucket } from "./test-bucket.js";
import type { Environment, Session } from "./types.js";
import { createHandler } from "./worker.js";

const repositoryName = "Xpotato1024/xpotato-site";
const origin = "https://xpotato.example";
const contentId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const branch = "content/cli-media";
const commit = "a".repeat(40);
const path = "content/projects/example.mdx";
const source = `---\nid: ${contentId}\ntitle: 図のある下書き\ndraft: true\n---\n<Figure asset="diagram" alt="構成" />\n`;
const blue = Uint8Array.from(Buffer.from("UklGRhwAAABXRUJQVlA4TBAAAAAvAUAAAAdQwOh//wMR0f8A", "base64"));
const orange = Uint8Array.from(Buffer.from("UklGRhwAAABXRUJQVlA4TBAAAAAvAUAAAAdQoP5H/wMR0f8A", "base64"));
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const principal: CLIPrincipal = {
  userId: "190472511",
  login: "Xpotato1024",
  token: "gho_private-fixture-credential",
  repository: repositoryName,
};

function manifestFixture(bytes = blue): MediaHandoffManifest {
  return {
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-manifest-v1",
    repository: repositoryName,
    source: { contentId, branch, commit, path, sha256: hash(source) },
    assets: [{
      assetId: "diagram",
      metadata: {
        schemaVersion: 1,
        profile: "editor-draft-media-v1",
        kind: "technical",
        sourceSha256: hash(bytes),
        sha256: hash(bytes),
        previewSha256: hash(bytes),
        sourceBytes: bytes.length,
        bytes: bytes.length,
        previewBytes: bytes.length,
        mime: "image/webp",
        width: 2,
        height: 2,
        lossy: false,
        resized: false,
        metadataStripped: true,
        sourceRetained: false,
        transform: "technical-webp-lossless-v1",
      },
    }],
  };
}

function fixture() {
  const bucket = new MemoryBucket();
  const store = new DraftStore(bucket);
  const control = { head: commit, source, path, branch, failure: null as Error | null };
  const gitCalls: GitRequest[] = [];
  const repository = new GitRepository(async <T>(request: GitRequest): Promise<T> => {
    gitCalls.push(request);
    if (control.failure) {
      throw control.failure;
    }
    if (request.method !== "GET") {
      throw Error("GIT_WRITE_MUST_NOT_RUN");
    }
    if (request.path === "/git/ref/heads/" + control.branch) {
      return { object: { sha: control.head } } as T;
    }
    if (request.path === "/contents/" + control.path + "?ref=" + commit) {
      return {
        type: "file",
        encoding: "base64",
        content: Buffer.from(control.source).toString("base64"),
        sha: "b".repeat(40),
        size: Buffer.byteLength(control.source),
      } as T;
    }
    throw new GitError("GIT_NOT_FOUND", 404);
  }, repositoryName);
  const env: Environment = {
    DRAFT_MEDIA: bucket,
    OWNER_GITHUB_ID: principal.userId,
    EDITOR_REPOSITORY: repositoryName,
    EDITOR_ORIGIN: origin,
    GITHUB_APP_ID: "123",
    GITHUB_CLIENT_ID: "fixture-client",
    GITHUB_CLIENT_SECRET: "fixture-secret",
    SESSION_SECRET: "fixture-only-secret-at-least-thirty-two-characters",
    GC_ENABLED: "false",
  };
  const handle = createHandler({
    cliAuthenticate: async () => principal,
    cliGit: () => repository,
    git: () => repository,
  });
  const send = (route: string, value?: unknown, method = "POST") => handle(
    new Request(origin + "/editor-api" + route, {
      method,
      headers: {
        Authorization: "Bearer " + principal.token,
        ...(value === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    }),
    env,
  );
  const upload = (id: string, bytes = blue) => handle(
    new Request(origin + "/editor-api/cli/media/upload/" + id, {
      method: "PUT",
      headers: { Authorization: "Bearer " + principal.token },
      body: bytes,
    }),
    env,
  );
  const create = async (manifest = manifestFixture()) => {
    const response = await send("/cli/media-handoff", { manifest, mode: "create" });
    expect([200, 201]).toContain(response.status);
    return (await response.json()) as { draft: DraftRecord; assets: AssetRecord[] };
  };
  const reserve = async (manifest = manifestFixture()) => {
    const { draft } = await create(manifest);
    const response = await send("/cli/media/reserve", {
      manifest,
      draftId: draft.id,
      expectedDraftRevision: draft.revision,
      assetId: "diagram",
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Reservation;
  };
  return { bucket, store, control, gitCalls, repository, env, handle, send, upload, create, reserve };
}

async function browserHeaders(env: Environment): Promise<Record<string, string>> {
  const identity: Session = {
    ...principal,
    csrf: "fixture-csrf",
    issued: Date.now(),
    expires: Date.now() + 60000,
  };
  return {
    Cookie: "__Host-xpotato-editor=" + await seal(identity, env.SESSION_SECRET),
    Origin: env.EDITOR_ORIGIN,
    "X-CSRF-Token": identity.csrf,
    "Content-Type": "application/json",
  };
}

describe("CLI media registration validates Git before private mutations", () => {
  it("inspect is read-only; same identity creates converge without rewinding activity", async () => {
    const f = fixture();
    const manifest = manifestFixture();
    const inspected = await f.send("/cli/media-handoff", { manifest, mode: "inspect" });
    expect(inspected.status).toBe(200);
    expect(await inspected.json()).toEqual({ repository: repositoryName, source: manifest.source, draft: null, assets: [] });
    expect(f.bucket.writes).toEqual([]);
    const [first, second] = await Promise.all([f.create(), f.create()]);
    expect(first.draft.id).toBe(second.draft.id);
    expect(Object.keys((await f.store.read()).state.drafts)).toHaveLength(1);
    await f.store.transact((state) => {
      state.drafts[first.draft.id]!.commit = "c".repeat(40);
      state.drafts[first.draft.id]!.revision = 9;
    });
    const before = f.bucket.writes.length;
    const resumed = await f.create();
    expect(resumed.draft).toMatchObject({ id: first.draft.id, commit: "c".repeat(40), revision: 9 });
    expect(f.bucket.writes).toHaveLength(before);
    expect(f.gitCalls.every((request) => request.method === "GET")).toBe(true);
  });

  it.each([
    ["repository", "MEDIA_HANDOFF_REPOSITORY_MISMATCH"],
    ["branch", "GIT_NOT_FOUND"],
    ["main", "PROTECTED_BRANCH"],
    ["head", "MEDIA_HANDOFF_HEAD_CHANGED"],
    ["contentId", "MEDIA_HANDOFF_SOURCE_MISMATCH"],
    ["draft", "MEDIA_HANDOFF_SOURCE_MISMATCH"],
    ["hash", "MEDIA_HANDOFF_SOURCE_HASH_MISMATCH"],
    ["refs", "MEDIA_HANDOFF_REFERENCES_MISMATCH"],
    ["path", "GIT_NOT_FOUND"],
  ])("rejects wrong %s before creating any record", async (field, error) => {
    const f = fixture();
    const manifest = manifestFixture();
    if (field === "repository") manifest.repository = "other/repository";
    if (field === "branch") manifest.source.branch = "content/other";
    if (field === "main") manifest.source.branch = "main";
    if (field === "head") f.control.head = "d".repeat(40);
    if (field === "contentId") manifest.source.contentId = otherId;
    if (field === "draft") f.control.source = source.replace("draft: true", "draft: false");
    if (field === "hash") manifest.source.sha256 = "e".repeat(64);
    if (field === "refs") manifest.assets[0]!.assetId = "unreferenced";
    if (field === "path") manifest.source.path = "content/projects/other.mdx";
    const response = await f.send("/cli/media-handoff", { manifest, mode: "create" });
    expect(response.ok).toBe(false);
    expect(await response.json()).toEqual({ error });
    expect(f.bucket.writes).toEqual([]);
  });

  it.each(["deleted", "duplicate", "path"])("rejects %s identities without modifying them", async (kind) => {
    const f = fixture();
    const { draft } = await f.create();
    await f.store.transact((state) => {
      if (kind === "deleted") state.drafts[draft.id]!.state = "deleted";
      if (kind === "duplicate") state.drafts[otherId] = { ...state.drafts[draft.id]!, id: otherId };
      if (kind === "path") state.drafts[draft.id]!.sourcePath = "content/projects/other.mdx";
    });
    const before = f.bucket.writes.length;
    for (const mode of ["inspect", "create"]) {
      const response = await f.send("/cli/media-handoff", { manifest: manifestFixture(), mode });
      expect(response.status).toBe(kind === "deleted" ? 404 : 409);
    }
    expect(f.bucket.writes).toHaveLength(before);
  });

  it("uses the canonical draft path for legacy identities with no sourcePath", async () => {
    const f = fixture();
    const manifest = manifestFixture();
    manifest.source.path = draftPath(contentId);
    f.control.path = manifest.source.path;
    const draft = await createDraftRecord(f.store, { id: otherId, contentId, branch, commit });
    await f.store.transact((state) => { delete state.drafts[draft.id]!.sourcePath; });
    expect((await f.create(manifest)).draft.id).toBe(draft.id);
  });

  it("keeps the CLI no-resurrection policy inside the create CAS", async () => {
    const f = fixture();
    const { draft } = await f.create();
    await f.store.transact((state) => { state.drafts[draft.id]!.state = "deleted"; });
    const before = f.bucket.writes.length;
    await expect(createDraftRecord(f.store, {
      id: otherId, contentId, branch, commit, sourcePath: path,
    }, { rejectDeletedIdentity: true })).rejects.toThrow("DRAFT_NOT_FOUND");
    expect(f.bucket.writes).toHaveLength(before);
  });

  it("redacts unexpected Git errors even if their text resembles a safe code", async () => {
    const f = fixture();
    f.control.failure = Error("PRIVATE_FIXTURE_CREDENTIAL");
    const response = await f.send("/cli/media-handoff", { manifest: manifestFixture(), mode: "create" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "CLI_GIT_UNAVAILABLE" });
    expect(f.bucket.writes).toEqual([]);
  });
});

describe("CLI media reservations and upload preserve content and concurrency", () => {
  it("registers verified bytes, records their source, and supports readback and safe reuse", async () => {
    const f = fixture();
    const reservation = await f.reserve();
    expect(reservation).not.toHaveProperty("handoff");
    const saved = (await f.store.read()).state.reservations[reservation.id]!;
    expect(saved.handoff).toEqual({ manifest: manifestFixture(), expectedActiveHash: null });
    const response = await f.upload(reservation.id);
    expect(response.status).toBe(201);
    const asset = await response.json() as AssetRecord;
    expect(asset).not.toHaveProperty("key");
    expect(asset).toMatchObject({ sha256: hash(blue), width: 2, height: 2, handoffSource: {
      repository: repositoryName, source: manifestFixture().source,
    } });
    const readback = await f.send("/cli/media/" + asset.id, undefined, "GET");
    expect(readback.headers.get("Cache-Control")).toContain("no-store");
    expect(new Uint8Array(await readback.arrayBuffer())).toEqual(blue);
    const snapshot = await f.create();
    expect(snapshot.draft.assets.diagram).toBe(asset.id);
    const before = f.bucket.writes.length;
    const duplicate = await f.send("/cli/media/reserve", {
      manifest: manifestFixture(), draftId: snapshot.draft.id,
      expectedDraftRevision: snapshot.draft.revision, assetId: "diagram",
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: "MEDIA_HANDOFF_ALREADY_REGISTERED" });
    expect(f.bucket.writes).toHaveLength(before);
    const state = (await f.store.read()).state;
    expect(state.usedBytes).toBe(blue.length);
    expect(Object.keys(state.assets)).toEqual([asset.id]);
    expect(state.reservations).toEqual({});
    expect(JSON.stringify(state)).not.toContain(principal.token);
    expect(JSON.stringify(snapshot)).not.toContain(principal.token);
    expect(f.bucket.writes.every((key) => key === stateKey || key.startsWith("objects/"))).toBe(true);
  });

  it("rejects a different image without its exact preimage, then allows an explicit replacement", async () => {
    const f = fixture();
    const initial = await f.reserve();
    const initialResponse = await f.upload(initial.id);
    expect(initialResponse.status).toBe(201);
    const previous = await initialResponse.json() as AssetRecord;
    const replacement = manifestFixture(orange);
    const before = f.bucket.writes.length;
    const rejected = await f.send("/cli/media-handoff", { manifest: replacement, mode: "create" });
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toEqual({ error: "MEDIA_HANDOFF_REMOTE_CONFLICT" });
    expect(f.bucket.writes).toHaveLength(before);
    replacement.assets[0]!.expectedRemoteSha256 = hash(blue);
    const next = await f.reserve(replacement);
    const uploaded = await f.upload(next.id, orange);
    expect(uploaded.status).toBe(201);
    const asset = await uploaded.json() as AssetRecord;
    const state = (await f.store.read()).state;
    expect(state.drafts[asset.draftId]!.assets.diagram).toBe(asset.id);
    expect(state.assets[previous.id]!.status).toBe("rejected");
    expect(state.usedBytes).toBe(blue.length + orange.length);
  });

  it("checks preimages in the reservation CAS, not only at the route preflight", async () => {
    const f = fixture();
    const initial = await f.reserve();
    expect((await f.upload(initial.id)).status).toBe(201);
    const state = (await f.store.read()).state;
    const draft = Object.values(state.drafts)[0]!;
    const metadata = manifestFixture(orange).assets[0]!.metadata;
    const before = f.bucket.writes.length;
    await expect(reserveMedia(f.store, {
      draftId: draft.id, assetId: "diagram", expectedDraftRevision: draft.revision,
      sha256: metadata.sha256, bytes: metadata.bytes, kind: metadata.kind, mime: metadata.mime,
      sourceSha256: metadata.sourceSha256, sourceBytes: metadata.sourceBytes,
      transform: metadata.transform, sourceRetained: metadata.sourceRetained,
    }, { manifest: manifestFixture(orange), expectedActiveHash: null })).rejects.toThrow(
      "MEDIA_HANDOFF_REMOTE_CONFLICT",
    );
    expect(f.bucket.writes).toHaveLength(before);
  });

  it("rejects a stale revision after another editor changes the draft", async () => {
    const f = fixture();
    const reservation = await f.reserve();
    await editDraftState(f.store, { id: reservation.draftId, revision: 1, action: "review" });
    const before = f.bucket.writes.length;
    const response = await f.upload(reservation.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "DRAFT_CONFLICT" });
    expect(f.bucket.writes).toHaveLength(before);
    expect(Object.keys((await f.store.read()).state.assets)).toEqual([]);
  });

  it("rechecks the exact preimage at the final state CAS", async () => {
    const f = fixture();
    const initial = await f.reserve();
    expect((await f.upload(initial.id)).status).toBe(201);
    const replacement = manifestFixture(orange);
    replacement.assets[0]!.expectedRemoteSha256 = hash(blue);
    const next = await f.reserve(replacement);
    const put = f.bucket.put.bind(f.bucket);
    vi.spyOn(f.bucket, "put").mockImplementation(async (key, value, options) => {
      const result = await put(key, value, options);
      if (key.startsWith("objects/")) {
        await f.store.transact((state) => {
          const activeId = state.drafts[next.draftId]!.assets.diagram!;
          state.assets[activeId]!.sha256 = "f".repeat(64);
        });
      }
      return result;
    });
    const response = await f.upload(next.id, orange);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "MEDIA_HANDOFF_REMOTE_CONFLICT" });
    const state = (await f.store.read()).state;
    expect(state.drafts[next.draftId]!.assets.diagram).toBe(initial.id);
    expect(state.assets[initial.id]!.status).toBe("staged");
    expect(state.assets[next.id]).toBeUndefined();
    expect(state.reservations[next.id]!.status).toBe("uploading");
  });

  it.each(["bytes", "dimensions"])("rejects mismatched %s before writing an image object", async (kind) => {
    const f = fixture();
    const manifest = manifestFixture();
    if (kind === "dimensions") manifest.assets[0]!.metadata.width = 3;
    const reservation = await f.reserve(manifest);
    const bytes = blue.slice();
    if (kind === "bytes") bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    const response = await f.upload(reservation.id, bytes);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: kind === "bytes" ? "UPLOAD_HASH_MISMATCH" : "MEDIA_HANDOFF_METADATA_MISMATCH" });
    expect([...f.bucket.objects.keys()]).toEqual([stateKey]);
    expect((await f.store.read()).state.assets).toEqual({});
  });

  it("does not use a reservation after its Git branch has advanced", async () => {
    const f = fixture();
    const reservation = await f.reserve();
    const before = f.bucket.writes.length;
    f.control.head = "d".repeat(40);
    const response = await f.upload(reservation.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "MEDIA_HANDOFF_HEAD_CHANGED" });
    expect(f.bucket.writes).toHaveLength(before);
  });

  it.each(["object", "commit"])("reports Git drift during %s as a partial failure", async (stage) => {
    const f = fixture();
    const reservation = await f.reserve();
    const put = f.bucket.put.bind(f.bucket);
    vi.spyOn(f.bucket, "put").mockImplementation(async (key, value, options) => {
      const result = await put(key, value, options);
      const afterObject = stage === "object" && key.startsWith("objects/");
      const afterCommit = stage === "commit" && key === stateKey &&
        typeof value === "string" && Boolean(JSON.parse(value).assets[reservation.id]);
      if (afterObject || afterCommit) f.control.head = "d".repeat(40);
      return result;
    });
    const response = await f.upload(reservation.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "MEDIA_HANDOFF_HEAD_CHANGED" });
    const state = (await f.store.read()).state;
    if (stage === "object") {
      expect(state.assets).toEqual({});
      expect(state.reservations[reservation.id]!.status).toBe("uploading");
      expect(f.store.reserved(state)).toBe(blue.length);
    } else {
      expect(state.drafts[reservation.draftId]!.assets.diagram).toBe(reservation.id);
      expect(state.assets[reservation.id]!.handoffSource?.source.commit).toBe(commit);
    }
    expect(f.bucket.deletions).toEqual([]);
  });
});

describe("CLI and browser routes cannot borrow each other's authority", () => {
  it.each([
    ["POST", "/cli/save"], ["POST", "/cli/registry/save"],
    ["POST", "/cli/draft-review"], ["POST", "/cli/draft-state"],
    ["GET", "/cli/drafts"], ["GET", "/cli/gc/plan"],
    ["POST", "/cli/auth/logout"], ["GET", "/cli/media-handoff"],
    ["OPTIONS", "/cli/media/reserve"], ["POST", "/cli"],
  ])("returns 404 for %s %s without invoking any authority", async (method, route) => {
    const f = fixture();
    const auth = vi.fn(async () => principal);
    const handle = createHandler({ cliAuthenticate: auth });
    const response = await handle(new Request(origin + "/editor-api" + route, { method }), f.env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "NOT_FOUND" });
    expect(auth).not.toHaveBeenCalled();
    expect(f.bucket.writes).toEqual([]);
  });

  it("requires bearer authorization for all four CLI operations, including readback", async () => {
    const f = fixture();
    const handle = createHandler();
    for (const [method, route] of [
      ["POST", "/cli/media-handoff"], ["POST", "/cli/media/reserve"],
      ["PUT", "/cli/media/upload/" + contentId], ["GET", "/cli/media/" + contentId],
    ]) {
      const response = await handle(new Request(origin + "/editor-api" + route!, { method: method! }), f.env);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "CLI_AUTH_REQUIRED" });
    }
    expect(f.bucket.writes).toEqual([]);
  });

  it("does not treat bearer credentials as a browser cookie or CSRF proof", async () => {
    const f = fixture();
    const handle = createHandler();
    const bearerOnly = await handle(new Request(origin + "/editor-api/media/reserve", {
      method: "POST", headers: { Authorization: "Bearer " + principal.token },
    }), f.env);
    expect(bearerOnly.status).toBe(401);
    expect(await bearerOnly.json()).toEqual({ error: "AUTH_REQUIRED" });
    const headers = await browserHeaders(f.env);
    headers["X-CSRF-Token"] = "wrong";
    const wrongCSRF = await handle(new Request(origin + "/editor-api/media/reserve", {
      method: "POST", headers,
    }), f.env);
    expect(wrongCSRF.status).toBe(403);
    expect(await wrongCSRF.json()).toEqual({ error: "CSRF_REJECTED" });
    expect(f.bucket.writes).toEqual([]);
  });

  it("does not expose credentials in worker auth errors", async () => {
    const f = fixture();
    const handle = createHandler({ cliAuthenticate: (request, env) => authenticateCLI(request, env, async () => {
      throw Error(principal.token);
    }) });
    const response = await handle(new Request(origin + "/editor-api/cli/media-handoff", {
      method: "POST", headers: { Authorization: "Bearer " + principal.token },
    }), f.env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "CLI_AUTH_UNAVAILABLE" });
    expect(f.bucket.objects.size).toBe(0);
  });

  it("rejects browser-supplied internal binding fields and cross-channel uploads", async () => {
    const f = fixture();
    const reservation = await f.reserve();
    const headers = await browserHeaders(f.env);
    const before = f.bucket.writes.length;
    const browserUpload = await f.handle(new Request(origin + "/editor-api/media/upload/" + reservation.id, {
      method: "PUT", headers, body: blue,
    }), f.env);
    expect(browserUpload.status).toBe(409);
    expect(await browserUpload.json()).toEqual({ error: "CLI_UPLOAD_REQUIRED" });
    const { id: _id, expires: _expires, status: _status, ...input } = reservation;
    const forged = await f.handle(new Request(origin + "/editor-api/media/reserve", {
      method: "POST", headers, body: JSON.stringify({ ...input, handoff: { manifest: manifestFixture(), expectedActiveHash: null } }),
    }), f.env);
    expect(forged.status).toBe(400);
    expect(await forged.json()).toEqual({ error: "MEDIA_RESERVATION_FIELDS_INVALID" });
    expect(f.bucket.writes).toHaveLength(before);
    const normal = await reserveMedia(f.store, input);
    const cliUpload = await f.upload(normal.id);
    expect(cliUpload.status).toBe(409);
    expect(await cliUpload.json()).toEqual({ error: "CLI_UPLOAD_REQUIRED" });
  });

  it("rejects a claimed source or revision outside the validated CLI manifest", async () => {
    const f = fixture();
    const { draft } = await f.create();
    const before = f.bucket.writes.length;
    const extra = await f.send("/cli/media/reserve", {
      manifest: manifestFixture(), draftId: draft.id, expectedDraftRevision: draft.revision,
      assetId: "diagram", handoff: { source: { branch: "content/another" } },
    });
    expect(extra.status).toBe(400);
    expect(await extra.json()).toEqual({ error: "CLI_MEDIA_REQUEST_INVALID" });
    const otherSource = manifestFixture();
    otherSource.source.contentId = otherId;
    const wrongSource = await f.send("/cli/media/reserve", {
      manifest: otherSource, draftId: draft.id, expectedDraftRevision: draft.revision, assetId: "diagram",
    });
    expect(wrongSource.status).toBe(400);
    expect(await wrongSource.json()).toEqual({ error: "MEDIA_HANDOFF_SOURCE_MISMATCH" });
    expect(f.bucket.writes).toHaveLength(before);
  });
});
