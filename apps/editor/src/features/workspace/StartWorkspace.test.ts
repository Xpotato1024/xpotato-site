import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StartWorkspace } from "./StartWorkspace.js";
import type { GitWorkspace } from "../git/useGitWorkspace.js";

const path = "content/articles/09wsw5yvd59gqrjaz5ee25y3mw.mdx";
function html(withIndex: boolean) {
  const git = {
    auth: { authenticated: true },
    branches: ["main"],
    sourceBranch: "main",
    snapshot: { branch: "main", commit: "a".repeat(40) },
    documents: [{ path, sha: "b".repeat(40), bytes: 100 }],
    repositoryManifest: {
      contentIndex: withIndex
        ? [
            {
              path,
              contentId: "09e6785f-6da5-4c2f-892b-e573845f0e9c",
              title: "MuJoCo 4.0の新機能を画像で見る",
              collection: "blog",
              draft: false,
              education: false,
            },
          ]
        : undefined,
    },
    setSourceBranch: () => {},
    readBranch: async () => {},
  } as unknown as GitWorkspace;
  return renderToStaticMarkup(
    createElement(StartWorkspace, {
      intent: "revise",
      git,
      saved: [],
      busy: false,
      onNew: async () => {},
      onLocal: async () => {},
      onRemote: async () => {},
      onImport: async () => {
        throw Error("not used");
      },
      run: () => {},
    }),
  );
}
describe("Git document selection", () => {
  it("shows article title, type and publication state from the exact branch index", () => {
    const result = html(true);
    expect(result).toContain("MuJoCo 4.0の新機能を画像で見る");
    expect(result).toContain("記事");
    expect(result).toContain("公開済み");
    expect(result).not.toContain("公開状態未取得");
    expect(result).not.toContain("題名を取得できません");
    expect(result).not.toContain("articles/09wsw5yvd59gqrjaz5ee25y3mw.mdx");
  });
  it("does not disguise a missing index as a title", () => {
    const result = html(false);
    expect(result).toContain("記事タイトル索引を取得できていません");
    expect(result).toContain("題名を取得できません");
    expect(result).toContain("公開状態未取得");
    expect(result).toContain("articles/09wsw5yvd59gqrjaz5ee25y3mw.mdx");
  });
});
