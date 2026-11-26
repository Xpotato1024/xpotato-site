import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertMediaHandoffSource,
  mediaHandoffManifest,
  mediaHandoffPolicy,
  mediaHandoffReferences,
  parseMediaHandoff,
  parseMediaHandoffManifest,
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

describe("CLI媒体の登録manifest", () => {
  it("画像bytesや元ファイル名を送らず、原稿と置換前hashを固定する", async () => {
    const bundle = fixture();
    bundle.assets[0]!.expectedRemoteSha256 = "e".repeat(64);
    const manifest = mediaHandoffManifest(bundle);
    expect(manifest.source).toEqual(bundle.source);
    expect(manifest.assets[0]).toEqual({
      assetId: "architecture-editor",
      metadata: bundle.assets[0]!.prepared.metadata,
      expectedRemoteSha256: "e".repeat(64),
    });
    const json = JSON.stringify(manifest);
    expect(json).not.toContain("masterBase64");
    expect(json).not.toContain("previewBase64");
    expect(json).not.toContain("originalName");
    await expect(assertMediaHandoffSource(manifest, binding)).resolves.toBeUndefined();
  });

  it("同じsourceと画像参照の照合をAPI側でも使える", async () => {
    const manifest = mediaHandoffManifest(fixture());
    manifest.assets.pop();
    await expect(assertMediaHandoffSource(manifest, binding)).rejects.toThrow(
      "MEDIA_HANDOFF_REFERENCES_MISMATCH",
    );
    await expect(
      assertMediaHandoffSource(mediaHandoffManifest(fixture()), {
        ...binding,
        source: source + "更新\n",
      }),
    ).rejects.toThrow("MEDIA_HANDOFF_SOURCE_HASH_MISMATCH");
  });

  it("manifestの重複IDと不正な画像hashを拒否する", () => {
    const duplicate = mediaHandoffManifest(fixture());
    duplicate.assets[1]!.assetId = duplicate.assets[0]!.assetId;
    expect(() => parseMediaHandoffManifest(duplicate)).toThrow("MEDIA_HANDOFF_DUPLICATE_ASSET");
    const invalid = mediaHandoffManifest(fixture());
    invalid.assets[0]!.metadata.sha256 = "invalid";
    expect(() => parseMediaHandoffManifest(invalid)).toThrow("MEDIA_HANDOFF_PREPARED_INVALID");
  });

  it("metadataの未知fieldを予約へ残さず、動画の時間と画素予算を検査する", () => {
    const manifest = mediaHandoffManifest(fixture());
    const animated = {
      ...manifest.assets[0]!.metadata,
      kind: "animation",
      animation: { frameCount: 2, durationMs: 200, loop: 0, delaysMs: [100, 100], private: "drop" },
      playbackSha256: "f".repeat(64),
      private: "drop",
      masterBase64: "YWJj",
    };
    const input = { ...manifest, assets: [{ assetId: "motion", metadata: animated }] };
    const parsed = parseMediaHandoffManifest(input);
    expect(parsed.assets[0]!.metadata).not.toHaveProperty("private");
    expect(parsed.assets[0]!.metadata).not.toHaveProperty("masterBase64");
    expect(parsed.assets[0]!.metadata.animation).toEqual({
      frameCount: 2, durationMs: 200, loop: 0, delaysMs: [100, 100],
    });
    animated.animation.durationMs = 300;
    expect(() => parseMediaHandoffManifest(input)).toThrow("MEDIA_HANDOFF_ANIMATION_INVALID");
    animated.animation.durationMs = 200;
    animated.width = 8192;
    animated.height = 8192;
    expect(() => parseMediaHandoffManifest(input)).toThrow("MEDIA_HANDOFF_ANIMATION_INVALID");
  });

  it("本体画像の混入、巨大manifest、技術図の変換方針違反を拒否する", () => {
    const bytes = mediaHandoffManifest(fixture());
    expect(() =>
      parseMediaHandoffManifest({
        ...bytes,
        assets: [{ ...bytes.assets[0], masterBase64: "YWJj" }],
      }),
    ).toThrow("MEDIA_HANDOFF_ASSET_INVALID");
    expect(() =>
      parseMediaHandoffManifest({
        ...bytes,
        padding: "x".repeat(mediaHandoffPolicy.manifestBytes),
      }),
    ).toThrow("MEDIA_HANDOFF_MANIFEST_BYTES_LIMIT");
    const lossy = mediaHandoffManifest(fixture());
    lossy.assets[0]!.metadata.lossy = true;
    expect(() => parseMediaHandoffManifest(lossy)).toThrow(
      "MEDIA_HANDOFF_TECHNICAL_TRANSFORM_INVALID",
    );
  });
});
