import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createDraft, draftPath } from "@xpotato/editor-core/draft";
import { prepareDraftMedia } from "@xpotato/media-ingest/draft";
import { EditorGitHubFixture } from "../../../../ops/qa/fixtures/editor-github.js";
import { createHandler } from "../../../editor-api/src/worker.js";
import { MemoryBucket } from "../../../editor-api/src/test-bucket.js";
import { DraftStore } from "../../../editor-api/src/state.js";
import { APIError, type Environment } from "../../../editor-api/src/types.js";
import {
  prepareMediaHandoff,
  registerMediaHandoff,
  type MediaHandoffPorts,
} from "./media-handoff.js";
import type { LocalDraft, LocalMedia } from "./storage.js";
import type { RemoteDraft, RemoteMediaSnapshot } from "./media-sync.js";

const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const contentId = "11111111-1111-4111-8111-111111111111";
const branch = "content/ai-media-handoff";
const origin = "https://fixture.invalid";

async function fixture() {
  const manifest = JSON.parse(
    await readFile(new URL("../../../../content/registry/editor.json", import.meta.url), "utf8"),
  );
  const git = new EditorGitHubFixture(manifest);
  const snapshot = await git.repository.createBranch(await git.repository.snapshot("main"), branch);
  const source =
    createDraft("AIの図を含む原稿", "software", contentId) +
    '\n<Figure asset="architecture-editor" alt="編集" />\n\n<Figure asset="architecture-delivery" alt="配信" />\n';
  const path = draftPath(contentId);
  const saved = await git.repository.save({
    branch,
    expectedHead: snapshot.commit,
    path,
    source,
    producer: "ai",
  });
  const draft: LocalDraft = {
    id: crypto.randomUUID(),
    source,
    path,
    sourceBranch: branch,
    workingBranch: branch,
    baseCommit: saved.commit,
    baseSource: source,
    savedAt: new Date().toISOString(),
    producer: "ai",
  };
  const png = await sharp({ create: { width: 4, height: 3, channels: 4, background: "purple" } })
    .png()
    .toBuffer();
  const image = await prepareDraftMedia(png, "technical");
  const bundle = {
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-handoff-v1",
    repository: "fixture/editor",
    source: { contentId, branch, commit: saved.commit, path, sha256: hash(source) },
    assets: ["architecture-editor", "architecture-delivery"].map((assetId) => ({
      assetId,
      prepared: {
        schemaVersion: 1,
        protocol: "xpotato-private-editor-media-v1",
        metadata: image.metadata,
        originalName: assetId + ".png",
        masterBase64: image.master.toString("base64"),
        previewBase64: image.preview.toString("base64"),
      },
    })),
  };
  const file = () =>
    new File([JSON.stringify(bundle)], "handoff.json", { type: "application/json" });
  const bucket = new MemoryBucket();
  const session = {
    login: "fixture",
    userId: "fixture-owner",
    token: "fixture-only",
    csrf: "fixture-csrf",
    issued: Date.now(),
    expires: Date.now() + 60000,
  };
  const env: Environment = {
    DRAFT_MEDIA: bucket,
    GITHUB_CLIENT_ID: "fixture",
    GITHUB_CLIENT_SECRET: "fixture",
    SESSION_SECRET: "fixture-session-secret-at-least-thirty-two-characters",
    OWNER_GITHUB_ID: session.userId,
    EDITOR_ORIGIN: origin,
    EDITOR_REPOSITORY: "fixture/editor",
    GC_ENABLED: "false",
  };
  const handler = createHandler({
    authenticate: async (request, _env, write) => {
      if (
        write &&
        (request.headers.get("Origin") !== origin ||
          request.headers.get("X-CSRF-Token") !== session.csrf)
      ) {
        throw new APIError("CSRF_REJECTED", 403);
      }
      return session;
    },
    git: () => git.repository,
  });
  const calls: { route: string; method: string }[] = [];
  const local = new Map<string, LocalMedia>();
  const request: MediaHandoffPorts["request"] = async (route, options = {}) => {
    const method = options.method ?? "GET";
    calls.push({ route, method });
    const response = await handler(
      new Request(origin + "/editor-api" + route, {
        method,
        headers: {
          Origin: origin,
          "X-CSRF-Token": session.csrf,
          "Content-Type": "application/json",
        },
        ...(options.blob
          ? { body: options.blob }
          : options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
      }),
      env,
    );
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw Error(result.error);
    return result as never;
  };
  const ports: MediaHandoffPorts = {
    session: async () => ({ authenticated: true, configured: true, repository: "fixture/editor" }),
    request,
    find: async () => {
      const drafts = await request<RemoteDraft[]>("/drafts");
      const found = drafts.find((item) => item.contentId === contentId && item.branch === branch);
      return found ? request<RemoteMediaSnapshot>("/draft?id=" + found.id) : null;
    },
    fetchMedia: async (id) => {
      const response = await handler(new Request(origin + "/editor-api/media/" + id), env);
      if (!response.ok) throw Error("READBACK_FAILED");
      return response.blob();
    },
    localMedia: async () => [...local.values()],
    saveMedia: async (media) => {
      local.set(media.id, media);
    },
  };
  const prepared = await prepareMediaHandoff(file(), draft);
  return {
    git,
    draft,
    bundle,
    file,
    bucket,
    calls,
    ports,
    local,
    prepared,
    store: new DraftStore(bucket),
  };
}

describe("AI media handoff through the authenticated draft protocol", () => {
  it("preserves MDX asset IDs, reads back bytes, and reuses exact images on a second run", async () => {
    const f = await fixture();
    const source = f.draft.source;
    const result = await registerMediaHandoff(f.draft, f.prepared, { ports: f.ports });
    expect(result).toMatchObject({ registered: 2, reused: 0 });
    expect(result.draft.source).toBe(source);
    expect([...f.local.values()].map((item) => item.assetId)).toEqual([
      "architecture-editor",
      "architecture-delivery",
    ]);
    const before = f.bucket.writes.length;
    const again = await registerMediaHandoff(result.draft, f.prepared, { ports: f.ports });
    expect(again).toMatchObject({ registered: 0, reused: 2 });
    expect(f.bucket.writes.length).toBe(before);
    expect(Object.keys((await f.store.read()).state.drafts)).toHaveLength(1);
    expect(
      f.bucket.writes.every(
        (key) => key.startsWith("objects/") || key === "control/draft-state-v1.json",
      ),
    ).toBe(true);
  });

  it.each(["branch", "path", "source", "commit"])(
    "rejects a changed %s before writing",
    async (field) => {
      const f = await fixture();
      const changed = { ...f.draft };
      if (field === "branch") changed.workingBranch = "content/another";
      if (field === "path") changed.path = "content/articles/another.mdx";
      if (field === "source") changed.source += "\n未保存の追記";
      if (field === "commit") changed.baseCommit = "b".repeat(40);
      await expect(registerMediaHandoff(changed, f.prepared, { ports: f.ports })).rejects.toThrow();
      expect(f.calls.filter((call) => call.method !== "GET")).toEqual([]);
      expect(f.local.size).toBe(0);
    },
  );

  it("requires owner login and the same repository, even for a previously prepared file", async () => {
    const f = await fixture();
    f.ports.session = async () => ({
      authenticated: false,
      configured: true,
      repository: "fixture/editor",
    });
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow(
      "MEDIA_HANDOFF_LOGIN_REQUIRED",
    );
    f.ports.session = async () => ({
      authenticated: true,
      configured: true,
      repository: "fixture/other",
    });
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow();
    expect(f.calls).toEqual([]);
  });

  it("rejects a moved Git branch before creating a draft record", async () => {
    const f = await fixture();
    await f.git.repository.save({
      branch,
      expectedHead: f.draft.baseCommit,
      path: f.draft.path,
      source: f.draft.source + "\n次の編集",
      producer: "human",
    });
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow(
      "MEDIA_HANDOFF_GIT_CHANGED",
    );
    expect(f.bucket.writes).toEqual([]);
  });

  it("resumes a partial failure without uploading the first image again", async () => {
    const f = await fixture();
    const request = f.ports.request;
    let uploads = 0;
    f.ports.request = async (route, options) => {
      if (route.startsWith("/media/upload/") && ++uploads === 2)
        throw Error("SIMULATED_NETWORK_FAILURE");
      return request(route, options);
    };
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow(
      "SIMULATED_NETWORK_FAILURE",
    );
    expect(Object.keys((await f.store.read()).state.assets)).toHaveLength(1);
    f.ports.request = request;
    const result = await registerMediaHandoff(f.draft, f.prepared, { ports: f.ports });
    expect(result).toMatchObject({ registered: 1, reused: 1 });
    expect(Object.keys((await f.store.read()).state.assets)).toHaveLength(2);
  });

  it("does not overwrite conflicting local images or finish with corrupt readback", async () => {
    const f = await fixture();
    const media = f.prepared.media[0]!;
    f.local.set(media.id, { ...media, sha256: "c".repeat(64) });
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow(
      "DRAFT_MEDIA_LOCAL_CONFLICT",
    );
    expect(f.bucket.writes).toEqual([]);
    f.local.clear();
    f.ports.fetchMedia = async () => new Blob(["corrupt"]);
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow(
      "MEDIA_HANDOFF_READBACK_FAILED",
    );
    expect(f.local.size).toBe(0);
  });

  it("rejects another device's changed asset before the next upload", async () => {
    const f = await fixture();
    await registerMediaHandoff(f.draft, f.prepared, { ports: f.ports });
    await f.store.transact((state) => {
      const remote = Object.values(state.drafts)[0]!;
      state.assets[remote.assets["architecture-editor"]!]!.sha256 = "d".repeat(64);
      remote.revision++;
    });
    const writes = f.bucket.writes.length;
    await expect(registerMediaHandoff(f.draft, f.prepared, { ports: f.ports })).rejects.toThrow(
      "DRAFT_MEDIA_REMOTE_CONFLICT",
    );
    expect(f.bucket.writes.length).toBe(writes);
  });

  it("stops if the active draft changes, while retaining completed work", async () => {
    const f = await fixture();
    let active = true;
    await expect(
      registerMediaHandoff(f.draft, f.prepared, {
        ports: f.ports,
        assertCurrent: () => {
          if (!active) throw Error("MEDIA_HANDOFF_DRAFT_CHANGED");
        },
        onProgress: () => {
          active = false;
        },
      }),
    ).rejects.toThrow("MEDIA_HANDOFF_DRAFT_CHANGED");
    expect(f.local.size).toBe(1);
    expect(Object.keys((await f.store.read()).state.assets)).toHaveLength(1);
  });
});
