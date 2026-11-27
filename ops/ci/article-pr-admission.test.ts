import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { createDraftForCollection, parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import {
  parseEditorContentIndex,
  updateEditorContentIndex,
  type EditorContentIndex,
} from "@xpotato/editor-core/registry";
import { articleIndexPath, articleSourceCollection } from "./article-pr-policy.mjs";
import { inspectArticlePrAdmission } from "./article-pr-admission.js";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const addedId = "33333333-3333-4333-8333-333333333333";
const otherPath = "content/pages/other.mdx";
const context = {
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_REPOSITORY: "Xpotato1024/xpotato-site",
  PR_HEAD_REPOSITORY: "Xpotato1024/xpotato-site",
  PR_BASE_REPOSITORY: "Xpotato1024/xpotato-site",
  PR_BASE_REF: "main",
  GITHUB_REF: "refs/pull/234/merge",
};
function record(path: string, source: string) {
  const { data } = parseDraft(source);
  return {
    contentId: data.id,
    path,
    title: data.title,
    collection: articleSourceCollection(path)!,
    draft: data.draft === true,
    education: Boolean(data.education),
  };
}

function withRepository(
  run: (fixture: {
    cwd: string;
    path: string;
    original: string;
    base: string;
    write: (path: string, source: string) => void;
    save: (source: string, path?: string) => void;
    index: () => EditorContentIndex;
    setIndex: (value: unknown) => void;
    commit: () => string;
    admit: (env?: NodeJS.ProcessEnv) => ReturnType<typeof inspectArticlePrAdmission>;
  }) => void,
  {
    collection = "blog",
    published = false,
  }: { collection?: ContentCollection; published?: boolean } = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), "article-pr-admission-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), source);
  };
  const commit = () => {
    git("add", "-A");
    git(
      "-c",
      "user.name=CI Fixture",
      "-c",
      "user.email=ci@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    return git("rev-parse", "HEAD");
  };
  const path = "content/" + (collection === "blog" ? "articles" : collection) + "/example.mdx";
  let original =
    createDraftForCollection({ collection, title: "Original", id }) + "\nOriginal draft.\n";
  if (published) {
    original = updateDraft(original, {
      draft: false,
      description: "Published article",
      pubDate: "2026-11-20",
    });
  }
  let index: EditorContentIndex;
  const setIndex = (value: unknown) => {
    write(articleIndexPath, JSON.stringify(value, null, 2) + "\n");
    // Invalid registry fixtures are written without treating them as valid CMS state.
    try {
      index = parseEditorContentIndex(value);
    } catch {
      /* Admission must reject the committed bytes. */
    }
  };
  try {
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    const other = createDraftForCollection({
      collection: "pages",
      title: "Unrelated",
      id: otherId,
    });
    write(path, original);
    write(otherPath, other);
    index = parseEditorContentIndex({
      schemaVersion: 1,
      documents: [record(path, original), record(otherPath, other)].sort((a, b) =>
        a.path.localeCompare(b.path),
      ),
    });
    setIndex(index);
    const base = commit();
    const save = (source: string, target = path) => {
      write(target, source);
      setIndex(updateEditorContentIndex(index, record(target, source)));
    };
    run({
      cwd,
      path,
      original,
      base,
      write,
      save,
      index: () => structuredClone(index),
      setIndex,
      commit,
      admit: (env = {}) =>
        inspectArticlePrAdmission({
          cwd,
          env: { ...context, DIFF_BASE: base, EXPECTED_HEAD: git("rev-parse", "HEAD"), ...env },
        }),
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("CMS draft PR semantic admission", () => {
  it.each(["blog", "notes", "projects", "tools", "pages"] as const)(
    "admits body/title/index changes for an existing %s draft",
    (collection) => {
      withRepository(
        ({ original, save, commit, admit }) => {
          save(
            updateDraft(
              original,
              { title: "Revised", description: "Edited draft" },
              "## Revised\n\nDraft text.\n",
            ),
          );
          commit();
          expect(admit()).toEqual({
            eligible: true,
            reason: "portable drafts only; public state unchanged",
          });
        },
        { collection },
      );
    },
  );

  it("admits body-only edits with an unchanged index", () => {
    withRepository(({ original, path, write, commit, admit }) => {
      write(path, updateDraft(original, {}, "Changed body only.\n"));
      commit();
      expect(admit().eligible).toBe(true);
    });
  });

  it("admits a new draft and another edited draft with the exact shared CMS index update", () => {
    withRepository(({ original, save, commit, admit }) => {
      save(updateDraft(original, { title: "Revised" }));
      save(
        createDraftForCollection({ collection: "notes", title: "New note", id: addedId }) +
          "\nNew draft.\n",
        "content/notes/new-note.mdx",
      );
      commit();
      expect(admit().eligible).toBe(true);
    });
  });

  it("retains approved semantic modules and fenced code as valid draft content", () => {
    withRepository(({ original, save, commit, admit }) => {
      const body =
        '```js\nimport unsafe from "./example.js";\n```\n\n```md\n![example](../../package.json?url)\n```\n\n<Group>\n\n<Callout kind="note">\n\nText.\n\n</Callout>\n\n</Group>\n';
      save(updateDraft(original, {}, body));
      commit();
      expect(admit().eligible).toBe(true);
    });
  });

  it.each([
    "![example](../../package.json?url)\n",
    "![example][asset]\n\n[asset]: ../../package.json?url\n",
    "![asset][]\n\n[asset]: ../../package.json?url\n",
    "![example](https://example.invalid/image.png)\n",
    '<Callout kind="note">\n\n![example](./asset.png)\n\n</Callout>\n',
  ])("returns Markdown images and their compiler-generated dependencies to full CI: %s", (body) => {
    withRepository(({ original, save, commit, admit }) => {
      save(updateDraft(original, {}, body));
      commit();
      expect(admit()).toEqual({
        eligible: false,
        reason: "Markdown image compilation requires full CI",
      });
    });
  });

  it("also checks the old draft when a Markdown image is removed", () => {
    withRepository(({ original, save, commit, admit }) => {
      save(updateDraft(original, {}, "![example](../../package.json?url)\n"));
      const imageBase = commit();
      save(updateDraft(original, {}, "Plain text after the image was removed.\n"));
      commit();
      expect(admit({ DIFF_BASE: imageBase })).toEqual({
        eligible: false,
        reason: "Markdown image compilation requires full CI",
      });
    });
  });

  it.each([
    'import Thing from "./arbitrary.js";\n\n<Thing />\n',
    "export const value = 1;\n",
    "{globalThis.process}\n",
    '<div className="arbitrary">Text</div>\n',
    '<Callout kind={"note"}>Text</Callout>\n',
    "<Callout {...props}>Text</Callout>\n",
    '<Callout kind="unknown">Text</Callout>\n',
  ])("returns arbitrary or invalid MDX to full CI: %s", (body) => {
    withRepository(({ original, save, commit, admit }) => {
      save(updateDraft(original, {}, body));
      commit();
      expect(admit()).toEqual({ eligible: false, reason: "head is not a valid portable draft" });
    });
  });

  it.each([
    { published: false, next: false },
    { published: true, next: true },
    { published: true, next: false },
  ])(
    "keeps public changes on full CI (basePublished=$published, headDraft=$next)",
    ({ published, next }) => {
      withRepository(
        ({ original, save, commit, admit }) => {
          save(
            updateDraft(original, {
              draft: next,
              title: "Revised",
              description: "Article",
              pubDate: "2026-11-20",
            }),
          );
          commit();
          expect(admit().eligible).toBe(false);
        },
        { published },
      );
    },
  );

  it("admits a published revision only as a bound content draft PR with separate public baseline validation", () => {
    withRepository(
      ({ original, save, commit, admit, path }) => {
        save(updateDraft(original, { draft: true, title: "Revised" }, "New draft body.\n"));
        commit();
        const expected = {
          eligible: true,
          reason: "published revision; validate draft and exact public baseline separately",
          publishedBaseline: true,
          paths: [path],
        };
        expect(admit({ PR_IS_DRAFT: "true", PR_HEAD_REF: "content/revision" })).toEqual(expected);
        for (const patch of [
          { PR_IS_DRAFT: "false", PR_HEAD_REF: "content/revision" },
          { PR_IS_DRAFT: "true", PR_HEAD_REF: "fix/revision" },
          { PR_IS_DRAFT: "true", PR_HEAD_REF: "content/revision", CI_FORCE_FULL: "true" },
        ])
          expect(admit(patch).eligible).toBe(false);
      },
      { published: true, collection: "projects" },
    );
  });
  it("rejects a ContentId replacement even when the head index matches the replacement", () => {
    withRepository(({ original, path, write, index, setIndex, commit, admit }) => {
      write(path, original.replace(id, addedId));
      const changed = index();
      changed.documents.find((entry) => entry.path === path)!.contentId = addedId;
      setIndex(changed);
      commit();
      expect(admit()).toEqual({ eligible: false, reason: "ContentId changed" });
    });
  });

  it("rejects a new source that reuses another source's ContentId", () => {
    withRepository(({ write, index, setIndex, commit, admit }) => {
      const path = "content/articles/duplicate.mdx";
      const source = createDraftForCollection({
        collection: "blog",
        title: "Duplicate",
        id: otherId,
      });
      write(path, source);
      const changed = index();
      changed.documents = changed.documents.filter((entry) => entry.contentId !== otherId);
      changed.documents.push(record(path, source));
      setIndex(changed);
      commit();
      expect(admit().eligible).toBe(false);
    });
  });

  it.each(["title", "draft", "education"] as const)(
    "requires the %s index field to match the actual new draft",
    (field) => {
      withRepository(({ original, save, path, index, setIndex, commit, admit }) => {
        save(updateDraft(original, { title: "Revised" }));
        const changed = index();
        const row = changed.documents.find((entry) => entry.path === path)!;
        if (field === "title") row.title = "Mismatched";
        else if (field === "draft") row.draft = false;
        else row.education = true;
        setIndex(changed);
        commit();
        expect(admit().eligible).toBe(false);
      });
    },
  );

  it.each(["edit", "delete", "add"] as const)("rejects an unrelated index row %s", (operation) => {
    withRepository(({ original, save, index, setIndex, commit, admit }) => {
      save(updateDraft(original, { title: "Revised" }));
      const changed = index();
      if (operation === "edit")
        changed.documents.find((entry) => entry.path === otherPath)!.title = "Tampered";
      else if (operation === "delete")
        changed.documents = changed.documents.filter((entry) => entry.path !== otherPath);
      else
        changed.documents.push({
          contentId: addedId,
          path: "content/pages/unrelated.mdx",
          title: "Unrelated new",
          collection: "pages",
          draft: true,
          education: false,
        });
      setIndex(changed);
      commit();
      expect(admit().eligible).toBe(false);
    });
  });

  it.each(["extra-field", "invalid-id", "wrong-collection", "duplicate", "invalid-json"] as const)(
    "rejects malformed CMS indexes: %s",
    (mutation) => {
      withRepository(({ original, save, path, index, write, setIndex, commit, admit }) => {
        save(updateDraft(original, { title: "Revised" }));
        const changed = index();
        const row = changed.documents.find((entry) => entry.path === path)!;
        if (mutation === "extra-field") Object.assign(row, { arbitrary: true });
        else if (mutation === "invalid-id") row.contentId = "not-a-uuid";
        else if (mutation === "wrong-collection") row.collection = "notes";
        else if (mutation === "duplicate") changed.documents.push({ ...row });
        if (mutation === "invalid-json") write(articleIndexPath, "not json\n");
        else setIndex(changed);
        commit();
        expect(admit().eligible).toBe(false);
      });
    },
  );

  it("rechecks exact source identity, clean worktree and explicit full-CI requests after dependency installation", () => {
    withRepository(({ original, path, write, save, commit, admit, base }) => {
      save(updateDraft(original, { title: "Revised" }));
      commit();
      expect(admit({ EXPECTED_HEAD: base }).eligible).toBe(false);
      expect(admit({ CI_FORCE_FULL: "true" }).eligible).toBe(false);
      write(path, original + "\nUncommitted content.\n");
      expect(admit().eligible).toBe(false);
    });
  });

  it("returns a missing or stale matching index to full CI even on a body-only change", () => {
    withRepository(({ original, path, write, index, setIndex, commit, admit }) => {
      write(path, updateDraft(original, {}, "New body.\n"));
      const changed = index();
      changed.documents = changed.documents.filter((entry) => entry.path !== path);
      setIndex(changed);
      commit();
      expect(admit().eligible).toBe(false);
    });
  });

  it("requires the base index to describe the exact old draft before admitting a valid head", () => {
    withRepository(({ original, path, save, index, setIndex, commit, admit }) => {
      const stale = index();
      stale.documents.find((entry) => entry.path === path)!.title = "Wrong old title";
      setIndex(stale);
      const staleBase = commit();
      save(updateDraft(original, { title: "Valid new title" }));
      commit();
      expect(admit({ DIFF_BASE: staleBase })).toEqual({
        eligible: false,
        reason: "base index differs from its draft source",
      });
    });
  });
});
