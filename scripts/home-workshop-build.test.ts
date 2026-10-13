import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { canonicalRasterProfile, getMediaVariantProfileBinding, sharpToolchainSha256 } from "@xpotato/media-ingest";
import { copyHomeWorkshopBuildObjects, ensureHomeWorkshopPrivateParent, prepareVerifiedHomeWorkshopBinding, readHomeWorkshopBuildCandidate } from "./home-workshop-build.js";
import { readHomeWorkshopBuildBinding } from "../apps/site/src/lib/home-workshop-build.js";

const withFixture = async (run: (value: Awaited<ReturnType<typeof fixture>>) => Promise<void>) => {
  const value = await fixture();
  try { await run(value); } finally { await rm(value.workspace, { recursive: true, force: true }); }
};
const fixture = async () => {
  const workspace = await mkdtemp(join(tmpdir(), "workshop-build-"));
  const cache = join(workspace, ".local/home-workshop-build"), dist = join(workspace, "dist");
  await mkdir(cache, { recursive: true }); await mkdir(dist);
  await mkdir(join(workspace, "docs/design"), { recursive: true });
  const reviewed = JSON.parse(await readFile(new URL("../docs/design/home-workshop-candidate-v1.json", import.meta.url), "utf8"));
  const registry = structuredClone(reviewed.registryCandidate);
  const asset = registry.assets[0], objects = [asset.delivery.master, ...asset.delivery.variants];
  const localObjects = [];
  for (const [index, object] of objects.entries()) {
    const bytes = Buffer.from("fixture-only-" + index), hash = sha256(bytes);
    Object.assign(object, { sha256: hash, sizeBytes: bytes.length,
      objectKey: `media/v1/objects/sha256/${hash.slice(0, 2)}/${hash}.${object.format === "jpeg" ? "jpg" : object.format}` });
    const privateRelativePath = ".local/home-workshop-build/object-" + index;
    await writeFile(join(workspace, privateRelativePath), bytes);
    localObjects.push({ ...object, privateRelativePath });
  }
  const profile = getMediaVariantProfileBinding("photo-hero-v1"), toolchain = sharpToolchainSha256();
  const candidate = {
    state: "PRIVATE_CANDIDATE_ONLY", providerMutations: 0, productionBindingActive: false, source: reviewed.source,
    ingest: { source: { sourceSha256: reviewed.source.sha256, width: 2400, height: 1350 },
      canonicalMaster: { sha256: "a".repeat(64) },
      processing: { profileId: canonicalRasterProfile.id, profileSha256: fingerprint(canonicalRasterProfile), toolchainSha256: toolchain } },
    variants: { ...profile, toolchainSha256: toolchain, masterSha256: "a".repeat(64), contentId: registry.contentId,
      assetId: asset.assetId, variants: localObjects.slice(1).map(({objectKey: _key, ...object}) => ({ ...object, contentType: "image/" + object.format })) },
    registryCandidate: registry, localObjects, candidateSha256: "",
  };
  const save = async () => {
    const { candidateSha256: _hash, ...payload } = candidate;
    candidate.candidateSha256 = fingerprint(payload);
    await writeFile(join(cache, "candidate.json"), JSON.stringify(candidate));
  };
  await writeFile(join(workspace, "docs/design/home-workshop-candidate-v1.json"), JSON.stringify({ registryCandidate: registry }));
  await save();
  await prepareVerifiedHomeWorkshopBinding(workspace);
  return { workspace, cache, dist, candidate, save, dir: pathToFileURL(dist + "/") };
};

describe("frozen homepage photo build cache and artifact", () => {
  it("creates only the fresh private parent and preserves existing cache bytes", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "workshop-parent-"));
    try {
      await ensureHomeWorkshopPrivateParent(workspace);
      expect(await readdir(workspace)).toEqual([".local"]);
      expect(await readdir(join(workspace, ".local"))).toEqual([]);
    } finally { await rm(workspace, { recursive: true, force: true }); }
    await withFixture(async (f) => {
      const before = await readFile(join(f.cache, "candidate.json"), "utf8");
      await ensureHomeWorkshopPrivateParent(f.workspace);
      expect(await readFile(join(f.cache, "candidate.json"), "utf8")).toBe(before);
    });
  });
  it("reader resolves repo from both root and Astro workspace and uses only the verified binding", async () => {
    await withFixture(async (f) => {
      await mkdir(join(f.workspace, "apps/site"), { recursive: true });
      await writeFile(join(f.workspace, "package.json"), JSON.stringify({ name: "xpotato-site-vnext" }));
      for (const cwd of [f.workspace, join(f.workspace, "apps/site")]) {
        const spy = vi.spyOn(process, "cwd").mockReturnValue(cwd);
        try { expect(await readHomeWorkshopBuildBinding()).toEqual(f.candidate.registryCandidate.assets[0]); }
        finally { spy.mockRestore(); }
      }
      await rm(join(f.cache, "verified-binding.json"));
      await expect(readHomeWorkshopBuildBinding(f.workspace)).rejects.toThrow();
      await expect(copyHomeWorkshopBuildObjects(f.dir, f.workspace)).rejects.toThrow();
      expect(await readdir(f.dist)).toEqual([]);
    });
  });
  it("reader rejects whole-candidate drift and marker reuse cannot overwrite other bytes", async () => {
    await withFixture(async (f) => {
      f.candidate.ingest.source.width = 2399; await f.save();
      await expect(readHomeWorkshopBuildBinding(f.workspace)).rejects.toThrow("not prepared");
    });
    await withFixture(async (f) => {
      const marker = join(f.cache, "verified-binding.json");
      await writeFile(marker, "{}");
      await expect(prepareVerifiedHomeWorkshopBinding(f.workspace)).rejects.toThrow("prepared binding drift");
      expect(await readFile(marker, "utf8")).toBe("{}");
    });
  });
  it.skipIf(process.platform === "win32")("never follows an existing marker symlink", async () => {
    await withFixture(async (f) => {
      const marker = join(f.cache, "verified-binding.json"), outside = join(f.workspace, "outside-marker");
      const before = await readFile(marker, "utf8");
      await writeFile(outside, before); await rm(marker); await symlink(outside, marker);
      await expect(readHomeWorkshopBuildBinding(f.workspace)).rejects.toThrow("metadata path drift");
      await expect(prepareVerifiedHomeWorkshopBinding(f.workspace)).rejects.toThrow("prepared binding drift");
      expect(await readFile(outside, "utf8")).toBe(before);
      const metadata = join(f.cache, "candidate.json"), elsewhere = join(f.workspace, "outside-candidate");
      await writeFile(elsewhere, await readFile(metadata)); await rm(metadata); await symlink(elsewhere, metadata);
      await expect(readHomeWorkshopBuildCandidate(f.workspace)).rejects.toThrow("metadata path drift");
    });
  });
  it("uses exactly 13 reviewed byte objects in the same final dist and preserves immutable repeats", async () => {
    await withFixture(async (f) => {
      expect((await readHomeWorkshopBuildCandidate(f.workspace)).localObjects.length).toBe(13);
      await copyHomeWorkshopBuildObjects(f.dir, f.workspace);
      for (const object of f.candidate.localObjects) {
        expect(sha256(await readFile(join(f.dist, object.objectKey)))).toBe(object.sha256);
      }
      const first = join(f.dist, f.candidate.localObjects[0]!.objectKey), before = await stat(first);
      await copyHomeWorkshopBuildObjects(f.dir, f.workspace);
      expect((await stat(first)).mtimeMs).toBe(before.mtimeMs);
      expect(await readdir(f.dist)).toEqual(["media"]);
    });
  });

  it.each(["source", "profile", "toolchain", "canonical", "identity", "state", "fingerprint"])(
    "rejects cached %s drift without regenerating", async (kind) => {
      await withFixture(async (f) => {
        if (kind === "source") f.candidate.source.path = "other.jpg";
        if (kind === "profile") f.candidate.variants.profileSha256 = "b".repeat(64);
        if (kind === "toolchain") f.candidate.ingest.processing.toolchainSha256 = "b".repeat(64);
        if (kind === "canonical") f.candidate.variants.masterSha256 = "b".repeat(64);
        if (kind === "identity") f.candidate.variants.contentId = "00000000-0000-4000-8000-000000000000";
        if (kind === "state") f.candidate.productionBindingActive = true;
        await f.save();
        if (kind === "fingerprint") {
          f.candidate.candidateSha256 = "f".repeat(64);
          await writeFile(join(f.cache, "candidate.json"), JSON.stringify(f.candidate));
        }
        await expect(copyHomeWorkshopBuildObjects(f.dir, f.workspace)).rejects.toThrow();
        expect(await readdir(f.dist)).toEqual([]);
      });
    });

  it.each(["object-key", "missing-object", "registry", "size", "path"])("rejects %s drift before artifact copy", async (kind) => {
    await withFixture(async (f) => {
      if (kind === "object-key") f.candidate.localObjects[0]!.objectKey = "../../outside.jpg";
      if (kind === "missing-object") f.candidate.localObjects.pop();
      if (kind === "registry") f.candidate.registryCandidate.assets[0].defaultAlt = "unreviewed substitute";
      if (kind === "size") f.candidate.localObjects[0]!.sizeBytes += 1;
      if (kind === "path") f.candidate.localObjects[0]!.privateRelativePath = "../outside";
      await f.save();
      await expect(copyHomeWorkshopBuildObjects(f.dir, f.workspace)).rejects.toThrow();
      expect(await readdir(f.dist)).toEqual([]);
    });
  });

  it.each(["changed", "missing"])("rejects actual %s bytes and leaves the cache intact", async (kind) => {
    await withFixture(async (f) => {
      const path = join(f.workspace, f.candidate.localObjects[0]!.privateRelativePath);
      if (kind === "changed") await writeFile(path, "different bytes");
      else await rm(path);
      await expect(copyHomeWorkshopBuildObjects(f.dir, f.workspace)).rejects.toThrow();
      expect(await readdir(f.dist)).toEqual([]);
      expect(await readFile(join(f.cache, "candidate.json"), "utf8")).toContain(f.candidate.candidateSha256);
    });
  });

  it("refuses same-key/different-bytes overwrite in final dist", async () => {
    await withFixture(async (f) => {
      await copyHomeWorkshopBuildObjects(f.dir, f.workspace);
      const target = join(f.dist, f.candidate.localObjects[0]!.objectKey);
      await writeFile(target, "existing other bytes");
      await expect(copyHomeWorkshopBuildObjects(f.dir, f.workspace)).rejects.toThrow("immutable artifact collision");
      expect(await readFile(target, "utf8")).toBe("existing other bytes");
    });
  });

  it.skipIf(process.platform === "win32")("rejects source and artifact symlink escapes", async () => {
    await withFixture(async (f) => {
      const outside = join(f.workspace, "outside"); await mkdir(outside);
      await symlink(outside, join(f.dist, "media"));
      await expect(copyHomeWorkshopBuildObjects(f.dir, f.workspace)).rejects.toThrow("artifact path drift");
      expect(await readdir(outside)).toEqual([]);
      const object = f.candidate.localObjects[0]!, path = join(f.workspace, object.privateRelativePath);
      const bytes = await readFile(path); await rm(path);
      const alternate = join(outside, "same-bytes"); await writeFile(alternate, bytes); await symlink(alternate, path);
      await expect(readHomeWorkshopBuildCandidate(f.workspace)).rejects.toThrow("photo path drift");
    });
  });
});
