import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertMediaHandoffSource,
  mediaHandoffReferences,
  parseMediaHandoff,
  type MediaHandoff,
} from "./media-handoff.js";

const source =
  '---\nid: 11111111-1111-4111-8111-111111111111\ntitle: 図のある下書き\ndraft: true\nhero: cover\n---\n<Figure asset="architecture-editor" alt="構成" />\n';
const binding = {
  repository: "Xpotato1024/xpotato-site",
  branch: "content/ai-draft",
  commit: "a".repeat(40),
  path: "content/projects/example.mdx",
  source,
};
function fixture(): MediaHandoff {
  const prepared = {
    schemaVersion: 1,
    protocol: "xpotato-private-editor-media-v1",
    originalName: "diagram.webp",
    metadata: {
      schemaVersion: 1,
      profile: "editor-draft-media-v1",
      kind: "technical",
      sourceSha256: "b".repeat(64),
      sha256: "c".repeat(64),
      previewSha256: "d".repeat(64),
      sourceBytes: 3,
      bytes: 3,
      previewBytes: 3,
      mime: "image/webp",
      width: 1,
      height: 1,
      lossy: false,
      resized: false,
      metadataStripped: true,
      sourceRetained: false,
      transform: "technical-webp-lossless-v1",
    },
    masterBase64: "YWJj",
    previewBase64: "YWJj",
  };
  return parseMediaHandoff({
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-handoff-v1",
    repository: binding.repository,
    source: {
      contentId: "11111111-1111-4111-8111-111111111111",
      branch: binding.branch,
      commit: binding.commit,
      path: binding.path,
      sha256: createHash("sha256").update(source).digest("hex"),
    },
    assets: [
      { assetId: "architecture-editor", prepared },
      { assetId: "cover", prepared },
    ],
  });
}

describe("AI媒体の下書き引継ぎ契約", () => {
  it("既存MDXのassetIdと本文hashを保ち、heroも含めて照合する", async () => {
    const bundle = fixture();
    await expect(assertMediaHandoffSource(bundle, binding)).resolves.toBeUndefined();
    expect(bundle.assets.map((asset) => asset.assetId)).toEqual(["architecture-editor", "cover"]);
    expect(mediaHandoffReferences(source)).toEqual(["architecture-editor", "cover"]);
  });

  it.each([
    { repository: "another/repository" },
    { branch: "content/other" },
    { commit: "e".repeat(40) },
    { path: "content/projects/other.mdx" },
    {
      source: source.replace(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ),
    },
    { source: source.replace("draft: true", "draft: false") },
  ])("別の原稿bindingや公開済み本文を拒否する %j", async (change) => {
    await expect(assertMediaHandoffSource(fixture(), { ...binding, ...change })).rejects.toThrow(
      "MEDIA_HANDOFF_SOURCE_MISMATCH",
    );
  });

  it("同じcommit名でも本文が変わっていれば拒否する", async () => {
    await expect(
      assertMediaHandoffSource(fixture(), { ...binding, source: source + "改稿\n" }),
    ).rejects.toThrow("MEDIA_HANDOFF_SOURCE_HASH_MISMATCH");
  });

  it("不足した図と本文にない図を登録済みにしない", async () => {
    const missing = fixture();
    missing.assets.pop();
    await expect(assertMediaHandoffSource(missing, binding)).rejects.toThrow(
      "MEDIA_HANDOFF_REFERENCES_MISMATCH",
    );
    const extra = fixture();
    extra.assets.push({ ...extra.assets[0]!, assetId: "unreferenced" });
    await expect(assertMediaHandoffSource(extra, binding)).rejects.toThrow(
      "MEDIA_HANDOFF_REFERENCES_MISMATCH",
    );
  });

  it("重複ID、不正なhash、base64サイズの偽装を拒否する", () => {
    const duplicate = fixture();
    duplicate.assets[1]!.assetId = duplicate.assets[0]!.assetId;
    expect(() => parseMediaHandoff(duplicate)).toThrow("MEDIA_HANDOFF_DUPLICATE_ASSET");
    const hash = fixture();
    hash.assets[0]!.prepared.metadata.sha256 = "not-a-hash";
    expect(() => parseMediaHandoff(hash)).toThrow("MEDIA_HANDOFF_PREPARED_INVALID");
    const bytes = fixture();
    bytes.assets[0]!.prepared.masterBase64 = "YQ==";
    expect(() => parseMediaHandoff(bytes)).toThrow("MEDIA_HANDOFF_PREPARED_INVALID");
  });

  it("8 MiBの技術図も正規表現のstack overflowを起こさず検査する", () => {
    const bundle = fixture();
    const image = bundle.assets[0]!.prepared;
    image.metadata.bytes = 8 * 1024 * 1024;
    image.masterBase64 = Buffer.alloc(image.metadata.bytes).toString("base64");
    expect(parseMediaHandoff(bundle).assets[0]!.prepared.metadata.bytes).toBe(image.metadata.bytes);
  });

  it("main、許可外path、元端末のpath、技術図の非可逆変換を拒否する", () => {
    const main = fixture();
    main.source.branch = "main";
    expect(() => parseMediaHandoff(main)).toThrow("PROTECTED_BRANCH");
    const path = fixture();
    path.source.path = "docs/example.mdx";
    expect(() => parseMediaHandoff(path)).toThrow("CONTENT_PATH_NOT_ALLOWED");
    const name = fixture();
    name.assets[0]!.prepared.originalName = "/private/source.png";
    expect(() => parseMediaHandoff(name)).toThrow("MEDIA_HANDOFF_PREPARED_INVALID");
    const lossy = fixture();
    lossy.assets[0]!.prepared.metadata.lossy = true;
    expect(() => parseMediaHandoff(lossy)).toThrow("MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID");
  });
});
