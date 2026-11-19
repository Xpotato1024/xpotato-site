import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { taxonomyRegistrySchema } from "@xpotato/content-contracts/content";
import { createDraft, createDraftForCollection, draftPath, updateDraft } from "./draft.js";
import {
  GitError,
  GitRepository,
  editorManifestPath,
  type GitRegistrySaveInput,
  type GitRequest,
  type GitTransport,
} from "./git.js";
import {
  editorContentIndexPath,
  seriesRegistryPath,
  taxonomyRegistryPath,
  taxonomySnapshotFields,
  type EditorRegistryChanges,
} from "./registry.js";

const existingId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const missingId = "33333333-3333-4333-8333-333333333333";
const head = "a".repeat(40),
  nextHead = "b".repeat(40);
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const taxonomy = taxonomyRegistrySchema.parse({
  schemaVersion: 1,
  blogCategories: [
    {
      id: "software",
      label: "ソフトウェア",
      description: "設計",
      slug: "software",
      aliases: [],
      indexable: true,
      status: "active",
    },
  ],
  noteSubjects: [
    {
      id: "everyday",
      label: "日常",
      description: "日常のメモ",
      slug: "everyday",
      aliases: [],
      archive: true,
      indexable: false,
      status: "active",
    },
  ],
  toolCategories: [],
  tags: [],
});
function fixture() {
  const manifest = {
    contractVersion: 1,
    ...taxonomySnapshotFields(taxonomy),
    modules: [],
    contractHash: "fixture",
  };
  const files = new Map([
    [editorManifestPath, json(manifest)],
    [taxonomyRegistryPath, json(taxonomy)],
    [seriesRegistryPath, json({ schemaVersion: 1, series: [] })],
    [
      editorContentIndexPath,
      json({
        schemaVersion: 1,
        documents: [
          { contentId: existingId, path: draftPath(existingId), title: "前編", collection: "blog" },
        ],
      }),
    ],
    [draftPath(existingId), createDraft("前編", "software", existingId)],
  ]);
  const calls: GitRequest[] = [],
    blobs = new Map<string, string>();
  const state = { head, race: false };
  let pendingTree: { path: string; sha: string }[] = [];
  const api: GitTransport = async <T>(request: GitRequest) => {
    calls.push(request);
    let result: unknown;
    if (request.method === "GET" && request.path.startsWith("/git/ref/heads/"))
      result = { object: { sha: state.head } };
    else if (request.method === "GET" && request.path.startsWith("/contents/")) {
      const path = request.path.slice("/contents/".length).split("?")[0]!;
      const source = files.get(path);
      if (source === undefined) throw new GitError("GIT_NOT_FOUND", 404);
      result = {
        type: "file",
        encoding: "base64",
        content: Buffer.from(source).toString("base64"),
        size: Buffer.byteLength(source),
        sha: head,
      };
    } else if (request.method === "GET" && request.path.startsWith("/git/commits/"))
      result = { sha: head, tree: { sha: head }, parents: [] };
    else if (request.method === "POST" && request.path === "/git/blobs") {
      const source = Buffer.from((request.body as { content: string }).content, "base64").toString(
        "utf8",
      );
      const sha = createHash("sha1").update(source).digest("hex");
      blobs.set(sha, source);
      result = { sha };
    } else if (request.method === "POST" && request.path === "/git/trees") {
      pendingTree = (request.body as { tree: typeof pendingTree }).tree;
      result = { sha: nextHead };
    } else if (request.method === "POST" && request.path === "/git/commits")
      result = { sha: nextHead };
    else if (request.method === "PATCH" && request.path.startsWith("/git/refs/heads/")) {
      if (state.race) throw new GitError("GIT_CONFLICT", 422);
      for (const entry of pendingTree) files.set(entry.path, blobs.get(entry.sha)!);
      state.head = nextHead;
      result = { object: { sha: nextHead } };
    } else throw Error("UNEXPECTED " + request.path);
    return result as T;
  };
  const source = createDraft("後編", "software", id);
  return {
    repository: new GitRepository(api),
    calls,
    files,
    state,
    input: {
      branch: "content/series",
      expectedHead: head,
      path: draftPath(id),
      source,
      producer: "human" as const,
    },
  };
}
const changes: EditorRegistryChanges = {
  seriesBase: { schemaVersion: 1, series: [] },
  taxonomy: [
    { namespace: "tags", id: "course", label: "教材", kind: "purpose", aliases: ["レッスン"] },
  ],
  series: {
    schemaVersion: 1,
    series: [
      {
        id: "control-course",
        slug: "control-course",
        title: "制御入門",
        description: "モデルから制御まで",
        kind: "course",
        status: "ongoing",
        entries: [{ contentId: existingId }, { contentId: id }],
      },
    ],
  },
};

describe("atomic source and editorial registry writes", () => {
  it("preserves educational notes in the authenticated index when saving their source", async () => {
    const f = fixture();
    const source = createDraftForCollection({
      collection: "notes",
      subject: "everyday",
      education: true,
      id,
    });
    const saved = await f.repository.save({ ...f.input, path: draftPath(id, "notes"), source });
    expect(saved.manifest.contentIndex?.find((entry) => entry.contentId === id)).toMatchObject({
      collection: "notes",
      draft: true,
      education: true,
    });
    expect(f.files.get(draftPath(id, "notes"))).toBe(source);
  });
  it("commits the draft, new taxonomy, derived manifest, authenticated index, and series together", async () => {
    const f = fixture();
    const source = updateDraft(f.input.source, { tags: ["course"] });
    const result = await f.repository.save({ ...f.input, source, registryChanges: changes });
    expect(result.commit).toBe(nextHead);
    expect(result.manifest.tags).toContain("course");
    expect(result.manifest.seriesRegistry).toEqual(changes.series);
    expect(result.manifest.contentIndex).toHaveLength(2);
    expect(result.manifest.contentIndex?.find((entry) => entry.contentId === id)?.draft).toBe(true);
    expect(f.files.get(draftPath(id))).toBe(source);
    const tree = f.calls.find((call) => call.path === "/git/trees")!.body as {
      tree: { path: string }[];
    };
    expect(tree.tree.map((entry) => entry.path).sort()).toEqual(
      [
        draftPath(id),
        taxonomyRegistryPath,
        editorManifestPath,
        editorContentIndexPath,
        seriesRegistryPath,
      ].sort(),
    );
    expect(f.calls.filter((call) => call.path === "/git/commits")).toHaveLength(1);
    expect(f.calls.at(-1)?.body).toEqual({ sha: nextHead, force: false });
    const publicManifest = JSON.parse(f.files.get(editorManifestPath)!);
    expect(publicManifest.contentIndex).toBeUndefined();
    expect(publicManifest.seriesRegistry).toBeUndefined();
    expect(JSON.stringify(publicManifest)).not.toContain(existingId);
    expect(JSON.parse(f.files.get(taxonomyRegistryPath)!).tags[0]).toMatchObject({
      kind: "purpose",
      aliases: ["レッスン"],
    });
  });
  it("never partially updates taxonomy or order when the branch changes before ref update", async () => {
    const f = fixture(),
      before = new Map(f.files);
    f.state.race = true;
    await expect(f.repository.save({ ...f.input, registryChanges: changes })).rejects.toThrow(
      "GIT_CONFLICT",
    );
    expect(f.files).toEqual(before);
    expect(f.state.head).toBe(head);
  });
  it("rejects unknown series references, duplicate memberships, and arbitrary registry paths before writing objects", async () => {
    const invalid: unknown[] = [
      { files: [{ path: "apps/site/src/pages/index.astro", source: "attack" }] },
      { taxonomy: [{ ...changes.taxonomy![0], namespace: "../../workflows" }] },
      {
        seriesBase: changes.seriesBase,
        series: {
          ...changes.series,
          series: [{ ...changes.series!.series[0], entries: [{ contentId: missingId }] }],
        },
      },
      {
        seriesBase: changes.seriesBase,
        series: {
          ...changes.series,
          series: [
            { ...changes.series!.series[0], entries: [{ contentId: id }, { contentId: id }] },
          ],
        },
      },
    ];
    for (const registryChanges of invalid) {
      const f = fixture();
      await expect(
        f.repository.save({
          ...f.input,
          registryChanges: registryChanges as EditorRegistryChanges,
        }),
      ).rejects.toThrow();
      expect(f.calls.every((call) => call.method === "GET")).toBe(true);
    }
  });
  it("rejects source identity copies and stale taxonomy manifests", async () => {
    const f = fixture();
    await expect(
      f.repository.save({ ...f.input, source: createDraft("コピー", "software", existingId) }),
    ).rejects.toThrow("CONTENT_ID_PATH_CONFLICT");
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
    f.files.set(
      taxonomyRegistryPath,
      json({
        ...taxonomy,
        tags: [
          {
            id: "existing",
            label: "既存",
            slug: "existing",
            kind: "topic",
            aliases: [],
            archive: true,
            indexable: false,
            status: "active",
          },
        ],
      }),
    );
    await expect(f.repository.save({ ...f.input, registryChanges: changes })).rejects.toThrow(
      "EDITOR_MANIFEST_STALE",
    );
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });
  it("rejects a blind replacement of series the author never read even when expectedHead is current", async () => {
    const f = fixture();
    f.files.set(seriesRegistryPath, json(changes.series));
    await expect(
      f.repository.save({
        ...f.input,
        registryChanges: {
          seriesBase: { schemaVersion: 1, series: [] },
          series: { schemaVersion: 1, series: [] },
        },
      }),
    ).rejects.toMatchObject({ code: "SERIES_CONFLICT", status: 409 });
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });
  it("returns private indexes only from the authenticated API manifest, leaving the bundle manifest untouched", async () => {
    const f = fixture();
    const result = await f.repository.manifest({ branch: "main", commit: head });
    expect(result.contentIndex?.[0]?.title).toBe("前編");
    expect(result.seriesRegistry).toEqual({ schemaVersion: 1, series: [] });
    expect(JSON.parse(f.files.get(editorManifestPath)!).contentIndex).toBeUndefined();
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });
});

describe("standalone taxonomy and series management", () => {
  const standaloneChanges: EditorRegistryChanges = {
    ...changes,
    series: {
      schemaVersion: 1,
      series: [{ ...changes.series!.series[0]!, entries: [{ contentId: existingId }] }],
    },
  };
  const input = (registryChanges = standaloneChanges): GitRegistrySaveInput => ({
    branch: "content/site-organization",
    expectedHead: head,
    registryChanges,
  });

  it("saves taxonomy and reading order atomically without creating or changing an article", async () => {
    const f = fixture();
    const sourceBefore = f.files.get(draftPath(existingId));
    const indexBefore = f.files.get(editorContentIndexPath);
    const result = await f.repository.saveRegistry(input());
    expect(result).toMatchObject({ branch: input().branch, commit: nextHead });
    expect(result.manifest.tags).toContain("course");
    expect(result.manifest.seriesRegistry).toEqual(standaloneChanges.series);
    expect(f.files.get(draftPath(existingId))).toBe(sourceBefore);
    expect(f.files.get(editorContentIndexPath)).toBe(indexBefore);
    expect(f.files.has(draftPath(id))).toBe(false);
    const tree = f.calls.find((call) => call.path === "/git/trees")!.body as {
      tree: { path: string }[];
    };
    expect(tree.tree.map((entry) => entry.path).sort()).toEqual(
      [taxonomyRegistryPath, editorManifestPath, seriesRegistryPath].sort(),
    );
    const commit = f.calls.find((call) => call.path === "/git/commits")!.body as {
      parents: string[];
      message: string;
    };
    expect(commit.parents).toEqual([head]);
    expect(commit.message).toContain("Editor-Scope: registries");
    expect(commit.message).not.toContain("Content-Id:");
    expect(f.calls.at(-1)?.body).toEqual({ sha: nextHead, force: false });
    expect(JSON.parse(f.files.get(editorManifestPath)!).contentIndex).toBeUndefined();
  });

  it("allows an empty new series before any article belongs to it", async () => {
    const f = fixture();
    f.files.set(editorContentIndexPath, json({ schemaVersion: 1, documents: [] }));
    const result = await f.repository.saveRegistry(
      input({
        seriesBase: { schemaVersion: 1, series: [] },
        series: {
          schemaVersion: 1,
          series: [{ ...changes.series!.series[0]!, entries: [] }],
        },
      }),
    );
    expect(result.manifest.seriesRegistry?.series[0]?.entries).toEqual([]);
    expect(f.files.has(draftPath(id))).toBe(false);
  });

  it.each(["main", "dev", "feature/registry", "content/../main"])(
    "refuses registry writes to %s before accessing Git",
    async (branch) => {
      const f = fixture();
      await expect(f.repository.saveRegistry({ ...input(), branch })).rejects.toThrow();
      expect(f.calls).toEqual([]);
    },
  );

  it("rejects a branch that advanced before saving without creating objects", async () => {
    const f = fixture();
    f.state.head = nextHead;
    await expect(f.repository.saveRegistry(input())).rejects.toMatchObject({
      code: "GIT_CONFLICT",
      status: 409,
    });
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("rejects a race at ref update without partially changing either registry", async () => {
    const f = fixture();
    const before = new Map(f.files);
    f.state.race = true;
    await expect(f.repository.saveRegistry(input())).rejects.toThrow("GIT_CONFLICT");
    expect(f.files).toEqual(before);
    expect(f.state.head).toBe(head);
    expect(f.calls.at(-1)?.body).toEqual({ sha: nextHead, force: false });
  });

  it("rejects unobserved series replacement and references to an article that only exists locally", async () => {
    const f = fixture();
    await expect(f.repository.saveRegistry(input(changes))).rejects.toThrow(
      "SERIES_REFERENCE_INVALID",
    );
    f.files.set(seriesRegistryPath, json(standaloneChanges.series));
    await expect(
      f.repository.saveRegistry(
        input({
          seriesBase: { schemaVersion: 1, series: [] },
          series: { schemaVersion: 1, series: [] },
        }),
      ),
    ).rejects.toMatchObject({ code: "SERIES_CONFLICT", status: 409 });
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("refuses empty operations and arbitrary file writes", async () => {
    for (const value of [
      input({}),
      input({ taxonomy: [] }),
      { ...input(), path: ".github/workflows/deploy.yml", source: "attack" },
      {
        ...input(),
        registryChanges: { files: [{ path: "content/pages/a.mdx", source: "attack" }] },
      },
    ]) {
      const f = fixture();
      await expect(f.repository.saveRegistry(value as GitRegistrySaveInput)).rejects.toThrow();
      expect(f.calls.every((call) => call.method === "GET")).toBe(true);
    }
  });
});
