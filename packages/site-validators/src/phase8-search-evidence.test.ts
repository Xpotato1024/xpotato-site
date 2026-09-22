import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildSearchIndex } from "../../../apps/site/src/search/build-index.js";
import { buildPhase8SearchEvidence } from "./phase8-search-evidence.js";

const taskTempRoot = resolve(process.env.CODEX_TASK_TEMP_ROOT ?? tmpdir());
let fixtureRoot: string | undefined;

afterAll(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

const page = (id: string, title: string, body: string, extraHead = "", eligibility = "true"): string =>
  `<!doctype html><html><head>${extraHead}</head><body><main data-search-body data-search-eligible="${eligibility}" data-search-id="${id}" data-search-collection="blog" data-search-title="${title}" data-search-description="A &amp; B" data-search-taxonomy="phase8"><article><h1>${title}</h1><p>${body}</p><script>script-only-noise</script><style>.style-only-noise {}</style></article></main></body></html>`;

describe("Phase 8 search evidence", () => {
  it("builds the serialized index from eligible rendered HTML and reports production and synthetic evidence separately", async () => {
    fixtureRoot = await mkdtemp(join(taskTempRoot, "phase8-search-evidence-"));
    if (process.env.CODEX_TASK_TEMP_ROOT) {
      const relativePath = relative(taskTempRoot, fixtureRoot);
      expect(relativePath.startsWith(`..${sep}`) || relativePath === "..").toBe(false);
    }
    const distRoot = join(fixtureRoot, "dist");
    const writePage = async (path: string, html: string) => {
      const output = join(distRoot, path);
      await mkdir(join(output, ".."), { recursive: true });
      await writeFile(output, html, "utf8");
    };
    await writePage("blog/alpha/index.html", page("f8a847d4-8f5d-4bb0-a387-750f096479f2", "Alpha &amp; Beta", "新幹線 Astro MDX"));
    await writePage("blog/noindex/index.html", page("a52fc28a-a5dc-4c15-8779-b82e79de8ce2", "Noindex", "must be absent", '<meta name="robots" content="noindex,follow">'));
    await writePage("blog/ineligible/index.html", page("bb15ded2-15fb-45d5-8e19-22b831905f27", "Ineligible", "must be absent", "", "false"));

    const built = await buildSearchIndex(distRoot);
    const evidence = await buildPhase8SearchEvidence(distRoot);

    expect(built.documents.map(({ route }) => route)).toEqual(["/blog/alpha/"]);
    expect(built.documents[0]).toMatchObject({
      title: "Alpha & Beta",
      description: "A & B",
      headingText: "Alpha & Beta",
      bodyText: expect.not.stringContaining("script-only-noise"),
    });
    expect(built.documents[0]?.bodyText).not.toContain("style-only-noise");
    expect(evidence.profile.tokenizerId).toBe("xpotato-ja-tech-bigram-v1");
    expect(evidence.profileSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(evidence.index.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(evidence.index.documentCount).toBe(1);
    expect(evidence.index.documents).toEqual([
      { id: "f8a847d4-8f5d-4bb0-a387-750f096479f2", route: "/blog/alpha/", title: "Alpha & Beta", collection: "blog" },
    ]);
    expect(evidence.synthetic.testOnly).toBe(true);
    expect(evidence.synthetic.pass).toBe(true);
    expect(evidence.synthetic.cases.every(({ pass }) => pass)).toBe(true);
    expect(evidence.synthetic.cases.every(({ expected, actual }) =>
      actual[0]?.id === expected.id && actual[0].route === expected.route && actual[0].title === expected.title,
    )).toBe(true);
    expect(evidence.synthetic.excluded).toEqual({
      noindex: { route: "/fixtures/phase8-search-noindex/", rendered: true, indexed: false, pass: true },
      explicitIneligible: { route: "/fixtures/phase8-search-ineligible/", rendered: true, indexed: false, pass: true },
      draft: { route: "/fixtures/phase8-search-draft-not-rendered/", rendered: false, indexed: false, pass: true },
    });
  });
});
