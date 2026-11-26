import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaHandoffPolicy, type MediaHandoff } from "@xpotato/editor-core/media-handoff";
import { inspectImage } from "@xpotato/editor-core/image-inspection";
import { prepareDraftMedia } from "@xpotato/media-ingest/draft";
import { parseRegistrationArguments, registerEditorHandoff } from "./register-editor-handoff.js";
import {
  createEditorHandoffClient,
  editorHandoffApi,
  readGitHubCliToken,
  registrationFailureCode,
  type EditorHandoffClient,
  type HandoffAsset,
  type HandoffSnapshot,
} from "./register-editor-handoff-client.js";

const temporary: string[] = [];
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const secret = "ghp_fake_test_credential_not_a_real_token_0123456789";
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "xpotato-draft-register-"));
  temporary.push(root);
  await mkdir(join(root, ".local"));
  const bundle: MediaHandoff = {
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-handoff-v1",
    repository: "Xpotato1024/xpotato-site",
    source: {
      contentId: randomUUID(),
      branch: "content/ai-draft",
      commit: "a".repeat(40),
      path: "content/projects/example.mdx",
      sha256: "b".repeat(64),
    },
    assets: [],
  };
  for (const [assetId, red] of [
    ["diagram-one", 70],
    ["diagram-two", 140],
  ] as const) {
    const original = await sharp({
      create: { width: 8, height: 4, channels: 4, background: { r: red, g: 20, b: 40, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const prepared = await prepareDraftMedia(original, "technical");
    bundle.assets.push({
      assetId,
      prepared: {
        schemaVersion: 1,
        protocol: "xpotato-private-editor-media-v1",
        originalName: assetId + ".webp",
        metadata: { ...prepared.metadata, mime: "image/webp", sourceRetained: false },
        masterBase64: prepared.master.toString("base64"),
        previewBase64: prepared.preview.toString("base64"),
      },
    });
  }
  const input = ".local/handoff.json";
  const save = () => writeFile(join(root, input), JSON.stringify(bundle));
  await save();
  return { root, input, bundle, save };
}

function memoryClient(bundle: MediaHandoff) {
  const snapshot: HandoffSnapshot = {
    repository: bundle.repository,
    source: { ...bundle.source },
    draft: null,
    assets: [],
  };
  const objects = new Map<string, Uint8Array>();
  const reservations = new Map<string, { assetId: string; revision: number }>();
  const faults = { upload: 0, read: 0, inspect: 0 };
  let uploadCount = 0;
  let readCount = 0;
  let inspectCount = 0;
  function draft() {
    snapshot.draft ??= {
      id: randomUUID(),
      contentId: bundle.source.contentId,
      branch: bundle.source.branch,
      commit: bundle.source.commit,
      sourcePath: bundle.source.path,
      revision: 0,
      lastEditedAt: new Date(0).toISOString(),
      state: "active",
      assets: {},
    };
    return snapshot.draft;
  }
  function seed(index: number, custom?: Uint8Array, id = randomUUID()): HandoffAsset {
    const entry = bundle.assets[index]!;
    const metadata = entry.prepared.metadata;
    const bytes = custom ?? Buffer.from(entry.prepared.masterBase64, "base64");
    const inspection = inspectImage(bytes, metadata.kind);
    const previous = snapshot.assets.find((asset) => asset.id === draft().assets[entry.assetId]);
    if (previous) previous.status = "rejected";
    const asset: HandoffAsset = {
      id,
      draftId: draft().id,
      assetId: entry.assetId,
      sha256: hash(bytes),
      sourceSha256: metadata.sourceSha256,
      bytes: bytes.length,
      mime: metadata.mime,
      kind: metadata.kind,
      createdAt: new Date(0).toISOString(),
      status: "staged",
      transform: metadata.transform,
      sourceBytes: metadata.sourceBytes,
      sourceRetained: false,
      width: inspection.width,
      height: inspection.height,
      frames: inspection.frames,
      durationMs: inspection.durationMs,
    };
    snapshot.assets.push(asset);
    objects.set(id, bytes.slice());
    draft().assets[entry.assetId] = id;
    draft().revision++;
    return asset;
  }
  const client = {
    inspect: vi.fn<EditorHandoffClient["inspect"]>(async (_manifest, mode) => {
      inspectCount++;
      if (inspectCount === faults.inspect) throw Error("MEDIA_HANDOFF_HEAD_CHANGED");
      if (mode === "create") draft();
      return structuredClone(snapshot);
    }),
    reserve: vi.fn<EditorHandoffClient["reserve"]>(async (input) => {
      if (!snapshot.draft || input.expectedDraftRevision !== snapshot.draft.revision) {
        throw Error("DRAFT_CONFLICT");
      }
      const id = randomUUID();
      reservations.set(id, { assetId: input.assetId, revision: input.expectedDraftRevision });
      return { id };
    }),
    upload: vi.fn<EditorHandoffClient["upload"]>(async (id, bytes) => {
      uploadCount++;
      if (uploadCount === faults.upload) throw Error("EDITOR_CLI_NETWORK_FAILED");
      const reservation = reservations.get(id)!;
      if (reservation.revision !== draft().revision) throw Error("DRAFT_CONFLICT");
      const index = bundle.assets.findIndex((entry) => entry.assetId === reservation.assetId);
      const asset = seed(index, bytes, id);
      reservations.delete(id);
      return structuredClone(asset);
    }),
    read: vi.fn<EditorHandoffClient["read"]>(async (id) => {
      readCount++;
      const bytes = objects.get(id)!.slice();
      if (readCount === faults.read) {
        const last = bytes.length - 1;
        bytes[last] = bytes[last]! ^ 1;
      }
      return bytes;
    }),
  };
  return { client, snapshot, objects, faults, seed };
}

describe("CLI private Draft registration", () => {
  it("registers stable image IDs, verifies every object twice, and writes a private complete receipt", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    const result = await registerEditorHandoff(
      { ...f, receipt: ".local/receipt.json" },
      { client: remote.client, now: () => 0 },
    );
    expect(result).toMatchObject({
      registered: 2,
      reused: 0,
      verified: true,
      source: f.bundle.source,
    });
    expect(result.assets.map((asset) => asset.assetId)).toEqual(["diagram-one", "diagram-two"]);
    expect(remote.client.read).toHaveBeenCalledTimes(4);
    expect(remote.client.reserve.mock.calls.map(([input]) => input.expectedDraftRevision)).toEqual([
      0, 1,
    ]);
    const text = await readFile(join(f.root, ".local/receipt.json"), "utf8");
    expect(JSON.parse(text)).toEqual(result);
    expect(text).not.toContain("masterBase64");
    expect(text).not.toContain("previewBase64");
    expect(text).not.toContain("Authorization");
    if (process.platform !== "win32")
      expect((await lstat(join(f.root, ".local/receipt.json"))).mode & 0o777).toBe(0o600);
  });

  it("verify-only reads existing bytes without create, reserve or upload", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    remote.seed(0);
    remote.seed(1);
    const before = structuredClone(remote.snapshot);
    const result = await registerEditorHandoff(
      { ...f, verifyOnly: true },
      { client: remote.client },
    );
    expect(result).toMatchObject({ mode: "verify", registered: 0, reused: 2, verified: true });
    expect(remote.client.inspect.mock.calls.every(([, mode]) => mode === "inspect")).toBe(true);
    expect(remote.client.reserve).not.toHaveBeenCalled();
    expect(remote.client.upload).not.toHaveBeenCalled();
    expect(remote.client.read).toHaveBeenCalledTimes(4);
    expect(remote.snapshot).toEqual(before);
  });

  it("verify-only fails missing images without creating a remote Draft", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    await expect(
      registerEditorHandoff({ ...f, verifyOnly: true }, { client: remote.client }),
    ).rejects.toThrow("MEDIA_HANDOFF_IMAGES_MISSING");
    expect(remote.client.inspect.mock.calls.map(([, mode]) => mode)).toEqual(["inspect"]);
    expect(remote.client.reserve).not.toHaveBeenCalled();
  });

  it("keeps successful images after a partial failure and reuses their actual bytes on rerun", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    remote.faults.upload = 2;
    await expect(
      registerEditorHandoff({ ...f, receipt: ".local/receipt.json" }, { client: remote.client }),
    ).rejects.toThrow("EDITOR_CLI_NETWORK_FAILED");
    expect(remote.client.upload).toHaveBeenCalledTimes(2);
    expect(remote.snapshot.draft!.assets["diagram-one"]).toBeDefined();
    await expect(lstat(join(f.root, ".local/receipt.json"))).rejects.toThrow("ENOENT");
    const firstId = remote.snapshot.draft!.assets["diagram-one"];
    remote.faults.upload = 0;
    const result = await registerEditorHandoff(f, { client: remote.client });
    expect(result).toMatchObject({ registered: 1, reused: 1, verified: true });
    expect(result.assets[0]!.remoteId).toBe(firstId);
    expect(remote.client.upload).toHaveBeenCalledTimes(3);
  });

  it("checks every existing preimage before uploading an earlier missing image", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    remote.seed(1, Buffer.from(f.bundle.assets[0]!.prepared.masterBase64, "base64"));
    await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
      "MEDIA_HANDOFF_REMOTE_CONFLICT",
    );
    expect(remote.client.reserve).not.toHaveBeenCalled();
    expect(remote.client.upload).not.toHaveBeenCalled();
  });

  it("replaces only the explicitly named previous hash", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    remote.seed(0);
    const old = remote.seed(1, Buffer.from(f.bundle.assets[0]!.prepared.masterBase64, "base64"));
    f.bundle.assets[1]!.expectedRemoteSha256 = old.sha256;
    await f.save();
    const result = await registerEditorHandoff(f, { client: remote.client });
    expect(result).toMatchObject({ registered: 1, reused: 1 });
    expect(result.assets[1]!.remoteId).not.toBe(old.id);
  });

  it.each([1, 3])(
    "stops on Git head drift at inspection %s without a successful receipt",
    async (at) => {
      const f = await fixture();
      const remote = memoryClient(f.bundle);
      remote.faults.inspect = at;
      await expect(
        registerEditorHandoff({ ...f, receipt: ".local/result.json" }, { client: remote.client }),
      ).rejects.toThrow("MEDIA_HANDOFF_HEAD_CHANGED");
      expect(remote.client.upload).toHaveBeenCalledTimes(at === 1 ? 0 : 1);
      await expect(lstat(join(f.root, ".local/result.json"))).rejects.toThrow("ENOENT");
    },
  );

  it.each([1, 3])(
    "rejects changed readback bytes, including the final whole-set read at GET %s",
    async (at) => {
      const f = await fixture();
      const remote = memoryClient(f.bundle);
      remote.faults.read = at;
      await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
        "MEDIA_HANDOFF_READBACK_FAILED",
      );
      expect(remote.client.read).toHaveBeenCalledTimes(at);
    },
  );

  it.each(["master", "preview"] as const)(
    "validates the last image's %s hash before any request",
    async (part) => {
      const f = await fixture();
      const remote = memoryClient(f.bundle);
      const metadata = f.bundle.assets[1]!.prepared.metadata;
      if (part === "master") metadata.sha256 = "c".repeat(64);
      else metadata.previewSha256 = "c".repeat(64);
      await f.save();
      await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
        "MEDIA_HANDOFF_IMAGE_HASH_MISMATCH",
      );
      expect(remote.client.inspect).not.toHaveBeenCalled();
    },
  );

  it("rejects a lossy WebP falsely declared as a lossless technical image", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    const prepared = f.bundle.assets[1]!.prepared;
    const lossy = await sharp(Buffer.from(prepared.masterBase64, "base64"))
      .webp({ quality: 50 })
      .toBuffer();
    prepared.masterBase64 = lossy.toString("base64");
    prepared.metadata.bytes = lossy.length;
    prepared.metadata.sha256 = hash(lossy);
    await f.save();
    await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
      "MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID",
    );
    expect(remote.client.inspect).not.toHaveBeenCalled();
  });

  it("requires real image decoding after a structurally valid header and matching hash", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    const prepared = f.bundle.assets[1]!.prepared;
    const invalid = Buffer.alloc(26);
    invalid.write("RIFF", 0);
    invalid.writeUInt32LE(18, 4);
    invalid.write("WEBPVP8L", 8);
    invalid.writeUInt32LE(5, 16);
    invalid[20] = 0x2f;
    invalid.writeUInt32LE(7 | (3 << 14), 21);
    expect(inspectImage(invalid, "technical")).toMatchObject({ width: 8, height: 4 });
    prepared.masterBase64 = invalid.toString("base64");
    prepared.metadata.bytes = invalid.length;
    prepared.metadata.sha256 = hash(invalid);
    await f.save();
    await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
      "MEDIA_HANDOFF_IMAGE_INVALID",
    );
    expect(remote.client.inspect).not.toHaveBeenCalled();
  });

  it("rejects hardlinked and oversized input before any request", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    await link(join(f.root, f.input), join(f.root, ".local/alias.json"));
    await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
      "EDITOR_CLI_INPUT_INVALID",
    );
    await rm(join(f.root, ".local/alias.json"));
    const file = await open(join(f.root, f.input), "w");
    await file.truncate(mediaHandoffPolicy.bundleBytes + 1);
    await file.close();
    await expect(registerEditorHandoff(f, { client: remote.client })).rejects.toThrow(
      "EDITOR_CLI_INPUT_INVALID",
    );
    expect(remote.client.inspect).not.toHaveBeenCalled();
  });

  it("rejects symlink input before any request", async (context) => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    const linked = join(f.root, ".local/linked.json");
    try {
      await symlink(join(f.root, f.input), linked);
    } catch (error) {
      if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") {
        context.skip();
        return;
      }
      throw error;
    }
    await expect(
      registerEditorHandoff({ ...f, input: linked }, { client: remote.client }),
    ).rejects.toThrow("EDITOR_CLI_INPUT_INVALID");
    expect(remote.client.inspect).not.toHaveBeenCalled();
  });

  it("rejects an existing receipt before network mutations", async () => {
    const f = await fixture();
    const remote = memoryClient(f.bundle);
    await writeFile(join(f.root, ".local/receipt.json"), "previous receipt\n");
    await expect(
      registerEditorHandoff({ ...f, receipt: ".local/receipt.json" }, { client: remote.client }),
    ).rejects.toThrow("EDITOR_CLI_RECEIPT_EXISTS");
    expect(remote.client.inspect).not.toHaveBeenCalled();
    expect(await readFile(join(f.root, ".local/receipt.json"), "utf8")).toBe("previous receipt\n");
  });
});

describe("existing gh authentication and fixed HTTPS transport", () => {
  it("reads the existing github.com credential through captured child stdout only", async () => {
    const run = vi.fn(async () => ({ stdout: secret + "\n" }));
    const output = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    expect(await readGitHubCliToken(run)).toBe(secret);
    expect(run).toHaveBeenCalledWith(
      "gh",
      ["auth", "token", "--hostname", "github.com"],
      expect.objectContaining({ encoding: "utf8", windowsHide: true }),
    );
    expect(output).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    await expect(
      readGitHubCliToken(async () => {
        throw Error(secret);
      }),
    ).rejects.toThrow("EDITOR_CLI_GH_AUTH_REQUIRED");
  });

  it("sends credentials only to the fixed API and refuses redirect without following it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: { location: "https://unrelated.invalid/" + secret },
      }),
    );
    const client = createEditorHandoffClient({ fetch: fetcher, readToken: async () => secret });
    await expect(client.read(randomUUID(), 100)).rejects.toThrow("EDITOR_CLI_REDIRECT_REJECTED");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url).startsWith(editorHandoffApi + "/media/")).toBe(true);
    expect(options).toMatchObject({ redirect: "manual", credentials: "omit", cache: "no-store" });
    expect(new Headers(options!.headers).get("Authorization")).toBe("Bearer " + secret);
    expect(String(url)).not.toContain(secret);
  });

  it("reports rejected authentication as a reconnect code without echoing provider bodies", async () => {
    const client = createEditorHandoffClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(secret, { status: 401 })),
      readToken: async () => secret,
    });
    await expect(client.read(randomUUID(), 100)).rejects.toThrow(
      "EDITOR_CLI_AUTH_RECONNECT_REQUIRED",
    );
  });

  it("redacts transport exceptions and unknown API codes, including credential-looking codes", async () => {
    for (const fetcher of [
      vi.fn<typeof fetch>().mockRejectedValue(Error(secret)),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: secret }, { status: 500 })),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: "ABCDEFGHIJKLMNOPQRSTUVWX" }, { status: 500 })),
    ]) {
      const client = createEditorHandoffClient({ fetch: fetcher, readToken: async () => secret });
      try {
        await client.read(randomUUID(), 100);
        throw Error("EXPECTED_FAILURE");
      } catch (error) {
        expect(registrationFailureCode(error)).toMatch(
          /^EDITOR_CLI_(NETWORK_FAILED|API_REQUEST_FAILED)$/u,
        );
        expect(String(error)).not.toContain(secret);
      }
    }
    expect(registrationFailureCode(Error(secret))).toBe("EDITOR_CLI_REGISTRATION_FAILED");
  });

  it("keeps actionable repository-owned failure codes", async () => {
    const client = createEditorHandoffClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: "MEDIA_HANDOFF_HEAD_CHANGED" }, { status: 409 })),
      readToken: async () => secret,
    });
    await expect(client.read(randomUUID(), 100)).rejects.toThrow("MEDIA_HANDOFF_HEAD_CHANGED");
  });

  it("bounds object responses even when the server declares a larger content length", async () => {
    const client = createEditorHandoffClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(new Uint8Array(16), { headers: { "content-length": "100000" } }),
        ),
      readToken: async () => secret,
    });
    await expect(client.read(randomUUID(), 16)).rejects.toThrow("MEDIA_HANDOFF_READBACK_FAILED");
  });

  it("accepts only the documented flags and never accepts token or origin arguments", () => {
    expect(
      parseRegistrationArguments([
        "--input",
        ".local/a.json",
        "--verify-only",
        "--receipt",
        ".local/r.json",
      ]),
    ).toEqual({ input: ".local/a.json", verifyOnly: true, receipt: ".local/r.json" });
    for (const args of [
      ["--input", "a", "--token", secret],
      ["--input", "a", "--origin", "https://unrelated.invalid"],
      ["--input", "a", "--input", "b"],
      ["--input", "--verify-only"],
    ])
      expect(() => parseRegistrationArguments(args)).toThrow("EDITOR_CLI_ARGUMENTS_INVALID");
  });
});
