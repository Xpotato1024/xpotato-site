import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { parseDraft, validateDraft } from "@xpotato/editor-core/draft";
import { blockTree, type BlockNode } from "@xpotato/editor-core/blocks";
import {
  parseEditorContentIndex,
  updateEditorContentIndex,
  type EditorContentRecord,
} from "@xpotato/editor-core/registry";
import {
  articleIndexPath,
  articleSourceCollection,
  inspectArticlePrDecision,
} from "./article-pr-policy.mjs";

export interface ArticlePrAdmission {
  eligible: boolean;
  reason: string;
}

// Astro can turn Markdown images into imports after portable MDX validation.
// Keep them on full CI; the CMS's registered Figure/Gallery modules remain eligible.
function hasMarkdownImage(node: BlockNode): boolean {
  return (
    node.type === "image" ||
    node.type === "imageReference" ||
    (node.children?.some(hasMarkdownImage) ?? false)
  );
}

export function inspectArticlePrAdmission({
  cwd = process.cwd(),
  env = process.env,
}: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ArticlePrAdmission {
  const candidate = inspectArticlePrDecision({ cwd, env });
  if (!candidate.article) return { eligible: false, reason: candidate.reason };
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const read = (revision: string, path: string) => git(["show", revision + ":" + path]);
  const base = env.DIFF_BASE!;
  const head = env.EXPECTED_HEAD!;
  try {
    const before = parseEditorContentIndex(JSON.parse(read(base, articleIndexPath)));
    const after = parseEditorContentIndex(JSON.parse(read(head, articleIndexPath)));
    let expected = before;
    for (const { path, status } of candidate.sources) {
      const collection = articleSourceCollection(path) as ContentCollection;
      const source = read(head, path);
      const next = parseDraft(source);
      if (next.data.draft !== true || validateDraft(source, collection).length) {
        return { eligible: false, reason: "head is not a valid portable draft" };
      }
      if (hasMarkdownImage(blockTree(next.body))) {
        return { eligible: false, reason: "Markdown image compilation requires full CI" };
      }
      const indexEntry = (data: ReturnType<typeof parseDraft>["data"]): EditorContentRecord =>
        parseEditorContentIndex({
          schemaVersion: 1,
          documents: [
            {
              contentId: data.id,
              path,
              title: data.title,
              collection,
              draft: data.draft === true,
              education: Boolean(data.education),
            },
          ],
        }).documents[0]!;
      if (status === "M") {
        const originalSource = read(base, path);
        const original = parseDraft(originalSource);
        if (original.data.draft !== true || validateDraft(originalSource, collection).length) {
          return { eligible: false, reason: "base is not a valid portable draft" };
        }
        if (hasMarkdownImage(blockTree(original.body))) {
          return { eligible: false, reason: "Markdown image compilation requires full CI" };
        }
        if (original.data.id !== next.data.id) {
          return { eligible: false, reason: "ContentId changed" };
        }
        if (
          !isDeepStrictEqual(
            before.documents.find((entry) => entry.path === path),
            indexEntry(original.data),
          )
        ) {
          return { eligible: false, reason: "base index differs from its draft source" };
        }
      } else if (
        before.documents.some((entry) => entry.path === path || entry.contentId === next.data.id)
      ) {
        return { eligible: false, reason: "new draft conflicts with an existing index entry" };
      }
      // The shared CMS operation preserves unrelated rows and rejects ID/path replacement.
      expected = updateEditorContentIndex(expected, indexEntry(next.data));
    }
    if (!isDeepStrictEqual(expected, after)) {
      return { eligible: false, reason: "head index is not the exact scoped CMS update" };
    }
    return { eligible: true, reason: "portable drafts only; public state unchanged" };
  } catch {
    // Inability to prove the bounded draft change selects full CI, never a successful check.
    return { eligible: false, reason: "draft source or index validation unavailable" };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = inspectArticlePrAdmission();
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, "eligible=" + result.eligible + "\n");
  }
  console.log(JSON.stringify(result));
}
