import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm, link, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { parseMediaHandoff, assertMediaHandoffSource } from "@xpotato/editor-core/media-handoff";
import { prepareEditorHandoff } from "./prepare-editor-handoff.js";

const runFile = promisify(execFile);
const temporary: string[] = [];
const contentId = "11111111-1111-4111-8111-111111111111";
const source = `---\nid: ${contentId}\ntitle: 技術図\ndraft: true\n---\n<Figure asset="architecture-editor" alt="構成図" />\n`;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "xpotato-editor-handoff-"));
  temporary.push(root);
  const git = async (...args: string[]) =>
    (await runFile("git", args, { cwd: root, encoding: "utf8" })).stdout.trim();
  await git("init", "-b", "content/ai-draft");
  await git("config", "user.name", "Fixture");
  await git("config", "user.email", "fixture@example.invalid");
  await git("config", "core.autocrlf", "false");
  await mkdir(join(root, "content/projects"), { recursive: true });
  await mkdir(join(root, ".local"));
  await writeFile(join(root, "content/projects/example.mdx"), source);
  await git("add", "content/projects/example.mdx");
  await git("commit", "-m", "fixture");
  const commit = await git("rev-parse", "HEAD");
  const image = await sharp({
    create: { width: 8, height: 4, channels: 4, background: { r: 77, g: 99, b: 121, alpha: 0.7 } },
  })
    .png()
    .toBuffer();
  await writeFile(join(root, ".local/private-original.png"), image);
  const plan = [
    { assetId: "architecture-editor", input: ".local/private-original.png", kind: "technical" },
  ];
  await writeFile(join(root, ".local/plan.json"), JSON.stringify(plan));
  const input = {
    root,
    source: "content/projects/example.mdx",
    branch: "content/ai-draft",
    commit,
    assets: ".local/plan.json",
    output: ".local/handoff.json",
  };
  return { root, git, input, image, plan };
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("固定Git原稿からAI媒体の引継ぎファイルを準備する", () => {
  it("未保存の本文を採用せず、lossless技術図と安定assetIdを私有ファイルへ出力する", async () => {
    const { root, input, image } = await fixture();
    await writeFile(join(root, input.source), source + "端末の未保存変更\n");
    const result = await prepareEditorHandoff(input);
    const raw = await readFile(join(root, input.output), "utf8");
    const bundle = parseMediaHandoff(JSON.parse(raw));
    await expect(
      assertMediaHandoffSource(bundle, {
        ...input,
        repository: "Xpotato1024/xpotato-site",
        path: input.source,
        source,
      }),
    ).resolves.toBeUndefined();
    expect(result).toMatchObject({
      uploaded: false,
      productionEligible: false,
      file: "handoff.json",
      contentId,
    });
    expect(raw).not.toContain(root);
    expect(raw).not.toContain("private-original.png");
    expect(raw).not.toContain("端末の未保存変更");
    const asset = bundle.assets[0]!;
    expect(asset.assetId).toBe("architecture-editor");
    expect(asset.prepared.metadata.sourceSha256).toBe(
      createHash("sha256").update(image).digest("hex"),
    );
    const normalized = Buffer.from(asset.prepared.masterBase64, "base64");
    expect(await sharp(normalized).raw().toBuffer()).toEqual(await sharp(image).raw().toBuffer());
    if (process.platform !== "win32")
      expect((await lstat(join(root, input.output))).mode & 0o777).toBe(0o600);
    await expect(prepareEditorHandoff(input)).rejects.toThrow("EEXIST");
  });

  it("ブランチの先頭が異なれば素材変換・出力より前に拒否する", async () => {
    const { root, input, git } = await fixture();
    await writeFile(join(root, input.source), source + "別の更新\n");
    await git("add", input.source);
    await git("commit", "-m", "new draft");
    await expect(prepareEditorHandoff(input)).rejects.toThrow("MEDIA_HANDOFF_BRANCH_STALE");
    await expect(lstat(join(root, input.output))).rejects.toThrow("ENOENT");
  });

  it("不足・重複・未参照の素材を引継ぎ一式と呼ばない", async () => {
    const { root, input, plan } = await fixture();
    for (const [value, expected] of [
      [[], "MEDIA_HANDOFF_PLAN_INVALID"],
      [[...plan, ...plan], "MEDIA_HANDOFF_DUPLICATE_ASSET"],
      [[{ ...plan[0], assetId: "unrelated" }], "MEDIA_HANDOFF_REFERENCES_MISMATCH"],
    ] as const) {
      await writeFile(join(root, input.assets), JSON.stringify(value));
      await expect(prepareEditorHandoff(input)).rejects.toThrow(expected);
    }
  });

  it("hardlink入力と公開領域への出力を拒否する", async () => {
    const { root, input } = await fixture();
    await link(join(root, ".local/private-original.png"), join(root, ".local/shared.png"));
    await expect(prepareEditorHandoff(input)).rejects.toThrow("MEDIA_INPUT_INVALID");
    await expect(
      prepareEditorHandoff({ ...input, output: "content/handoff.json" }),
    ).rejects.toThrow("DRAFT_MEDIA_OUTPUT_MUST_BE_PRIVATE");
  });
});
