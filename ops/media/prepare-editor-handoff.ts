import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, lstat, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, relative, basename, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { prepareDraftMedia } from "@xpotato/media-ingest/draft";
import { assertEditablePath, draftByteLimit, parseDraft } from "@xpotato/editor-core/draft";
import { assertWorkingBranch, defaultRepository } from "@xpotato/editor-core/git";
import {
  assertMediaHandoffSource,
  mediaHandoffReferences,
  mediaHandoffPolicy,
  parseMediaHandoff,
  type MediaHandoff,
} from "@xpotato/editor-core/media-handoff";
import { mediaPolicy, type MediaKind } from "@xpotato/editor-core/policy";

const runFile = promisify(execFile);
const within = (parent: string, child: string) => {
  const value = relative(parent, child);
  return value !== "" && !value.startsWith("..") && !isAbsolute(value);
};
interface MediaPlanItem {
  assetId: string;
  input: string;
  kind: MediaKind;
  allowLossy?: boolean;
  expectedRemoteSha256?: string;
}

async function privateInput(path: string, maximum: number): Promise<Buffer> {
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.size <= 0 ||
    stat.size > maximum ||
    (await realpath(path)) !== path
  ) {
    throw Error("MEDIA_INPUT_INVALID");
  }
  const bytes = await readFile(path);
  if (bytes.length !== stat.size) {
    throw Error("MEDIA_INPUT_CHANGED");
  }
  return bytes;
}

function parsePlan(value: unknown): MediaPlanItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > mediaHandoffPolicy.maxAssets) {
    throw Error("MEDIA_HANDOFF_PLAN_INVALID");
  }
  const seen = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw Error("MEDIA_HANDOFF_PLAN_INVALID");
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.assetId !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(candidate.assetId) ||
      candidate.assetId.length > 100 ||
      typeof candidate.input !== "string" ||
      candidate.input.length === 0 ||
      !["photo", "technical", "animation"].includes(String(candidate.kind)) ||
      (candidate.allowLossy !== undefined && typeof candidate.allowLossy !== "boolean") ||
      (candidate.expectedRemoteSha256 !== undefined &&
        (typeof candidate.expectedRemoteSha256 !== "string" ||
          !/^[a-f0-9]{64}$/u.test(candidate.expectedRemoteSha256)))
    ) {
      throw Error("MEDIA_HANDOFF_PLAN_INVALID");
    }
    if (seen.has(candidate.assetId)) {
      throw Error("MEDIA_HANDOFF_DUPLICATE_ASSET");
    }
    seen.add(candidate.assetId);
    return candidate as unknown as MediaPlanItem;
  });
}

export async function prepareEditorHandoff(input: {
  source: string;
  branch: string;
  commit: string;
  assets: string;
  output: string;
  repository?: string;
  root?: string;
}) {
  const root = resolve(input.root ?? ".");
  assertEditablePath(input.source);
  assertWorkingBranch(input.branch);
  if (!/^[a-f0-9]{40}$/u.test(input.commit)) {
    throw Error("MEDIA_HANDOFF_COMMIT_INVALID");
  }
  const repository = input.repository ?? defaultRepository;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw Error("MEDIA_HANDOFF_REPOSITORY_INVALID");
  }
  const target = resolve(root, input.output);
  if (
    !within(resolve(root, ".local"), target) &&
    !(within(resolve(process.env.RUNNER_TEMP ?? tmpdir()), target) && !within(root, target))
  ) {
    throw Error("DRAFT_MEDIA_OUTPUT_MUST_BE_PRIVATE");
  }
  const git = async (args: string[], maximum = draftByteLimit) => {
    try {
      return (await runFile("git", args, { cwd: root, maxBuffer: maximum, encoding: "utf8" }))
        .stdout;
    } catch {
      throw Error("MEDIA_HANDOFF_GIT_SOURCE_UNAVAILABLE");
    }
  };
  let branchHead: string | undefined;
  for (const ref of ["refs/remotes/origin/" + input.branch, "refs/heads/" + input.branch]) {
    try {
      branchHead = (await git(["rev-parse", "--verify", ref + "^{commit}"])).trim();
      break;
    } catch {
      // 読み取り専用のremote refがなければ、同名のローカル作業ブランチを使う。
    }
  }
  if (branchHead !== input.commit) {
    throw Error("MEDIA_HANDOFF_BRANCH_STALE");
  }
  const source = await git(["show", input.commit + ":" + input.source]);
  const parsed = parseDraft(source);
  if (parsed.data.draft !== true) {
    throw Error("MEDIA_HANDOFF_DRAFT_REQUIRED");
  }
  const plan = parsePlan(
    JSON.parse((await privateInput(resolve(root, input.assets), draftByteLimit)).toString("utf8")),
  );
  const refs = mediaHandoffReferences(source);
  const ids = plan.map((item) => item.assetId).sort();
  if (refs.length !== ids.length || refs.some((ref, index) => ref !== ids[index])) {
    throw Error("MEDIA_HANDOFF_REFERENCES_MISMATCH");
  }
  const assets: MediaHandoff["assets"] = [];
  let encodedSize = 0;
  for (const item of plan) {
    const bytes = await privateInput(resolve(root, item.input), mediaPolicy.inputBytes);
    const result = await prepareDraftMedia(bytes, item.kind, {
      allowLossy: item.allowLossy === true,
    });
    encodedSize +=
      Math.ceil(result.master.length / 3) * 4 + Math.ceil(result.preview.length / 3) * 4;
    if (encodedSize > mediaHandoffPolicy.bundleBytes) {
      throw Error("MEDIA_HANDOFF_BYTES_LIMIT");
    }
    assets.push({
      assetId: item.assetId,
      prepared: {
        schemaVersion: 1,
        protocol: "xpotato-private-editor-media-v1",
        // 元の端末の名前や絶対pathは、他端末へ渡す媒体ファイルに必要ない。
        originalName: item.assetId + ".webp",
        metadata: { ...result.metadata, mime: "image/webp", sourceRetained: false },
        masterBase64: result.master.toString("base64"),
        previewBase64: result.preview.toString("base64"),
      },
      ...(item.expectedRemoteSha256 ? { expectedRemoteSha256: item.expectedRemoteSha256 } : {}),
    });
  }
  const bundle = parseMediaHandoff({
    schemaVersion: 1,
    protocol: "xpotato-private-draft-media-handoff-v1",
    repository,
    source: {
      contentId: parsed.data.id,
      branch: input.branch,
      commit: input.commit,
      path: input.source,
      sha256: createHash("sha256").update(source).digest("hex"),
    },
    assets,
  });
  await assertMediaHandoffSource(bundle, {
    repository,
    branch: input.branch,
    commit: input.commit,
    path: input.source,
    source,
  });
  await mkdir(dirname(target), { recursive: true });
  if ((await realpath(dirname(target))) !== dirname(target)) {
    throw Error("OUTPUT_SYMLINK_DENIED");
  }
  await writeFile(target, JSON.stringify(bundle) + "\n", { flag: "wx", mode: 0o600 });
  return {
    file: basename(target),
    contentId: bundle.source.contentId,
    branch: bundle.source.branch,
    commit: bundle.source.commit,
    sourceSha256: bundle.source.sha256,
    assets: assets.map((asset) => ({
      assetId: asset.assetId,
      sha256: asset.prepared.metadata.sha256,
      bytes: asset.prepared.metadata.bytes,
    })),
    uploaded: false,
    productionEligible: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const value = (name: string) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const source = value("--source"),
    branch = value("--branch"),
    commit = value("--commit"),
    assets = value("--assets"),
    output = value("--output");
  if (!source || !branch || !commit || !assets || !output) {
    throw Error(
      "Usage: npm run editor:media:handoff -- --source content/...mdx --branch content/... --commit SHA --assets .local/media-plan.json --output .local/handoff.json [--repository owner/repo]",
    );
  }
  try {
    console.log(
      JSON.stringify(
        await prepareEditorHandoff({
          source,
          branch,
          commit,
          assets,
          output,
          ...(value("--repository") ? { repository: value("--repository")! } : {}),
        }),
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error && /^[A-Z][A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : "MEDIA_HANDOFF_PREPARATION_FAILED";
    console.error(message);
    process.exitCode = 1;
  }
}
