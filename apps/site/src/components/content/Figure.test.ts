import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import { figureModulePropsSchema } from "@xpotato/content-contracts";
import { validatePortableMdx } from "@xpotato/portable-content";
import { parseFragment } from "parse5";
import {resolveMediaCredits,renderMediaCredits} from "../../lib/media/media-credits.js";
import {creditContentId,creditContext,creditRights} from "../../lib/media/media-credits.test-fixtures.js";
let testContext=structuredClone({...creditContext,urlFor:undefined});
beforeEach(()=>{testContext=structuredClone({...creditContext,urlFor:undefined});});

// Compile the real Astro template. Only registry media resolution is a stand-in;
// the Figure's validation, conditional markup and native text escaping execute.
let render: (props: Record<string, unknown>) => Promise<string>;
let renderHero: (props: Record<string, unknown>) => Promise<string>;
beforeAll(async () => {
  const source = await readFile(new URL("./Figure.astro", import.meta.url), "utf8");
  const compiled = transform(source, { filename: "Figure.astro", resultScopedSlot: true });
  const code = ts.transpileModule(compiled.code, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS } }).outputText;
  const media = runtime.createComponent((_result, props) => runtime.render`<picture><img${runtime.addAttribute(props.alt, "alt")} width="640" height="320"></picture><button type="button">停止</button>`);
  const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
  const require = (id: string) => {
    // The standalone compiler emits legacy module metadata. This fixture has
    // no hydration or hoisted assets; rendering still uses the real runtime.
    if (id === "astro/runtime/server/index.js") return { ...runtime, createMetadata: () => ({}) };
    if (id === "./MediaPicture.astro") return { default: media };
    if (id === "@xpotato/portable-content/media-picture") return {renderRegistryPicture:()=>'<picture><img alt="合成表紙" width="640" height="320" loading="eager" fetchpriority="high"></picture>'};
    if (id === "@xpotato/content-contracts") return { figureModulePropsSchema };
    if (id === "../../lib/media/media-context.js") return { contentMediaContext:()=>testContext };
    if (id === "../../lib/media/media-credits.js") return { resolveMediaCredits,renderMediaCredits };
    throw new Error(`Unexpected Figure dependency: ${id}`);
  };
  new Function("require", "exports", code)(require, module.exports);
  const container = await experimental_AstroContainer.create();
  render = props => container.renderToString(module.exports.default, { props, locals:{xpotatoContentId:creditContentId} });
  const heroSource=await readFile(new URL("./MediaHero.astro",import.meta.url),"utf8");
  const heroCompiled=transform(heroSource,{filename:"MediaHero.astro",resultScopedSlot:true});
  const heroCode=ts.transpileModule(heroCompiled.code,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.CommonJS}}).outputText;
  const heroModule={exports:{} as {default:Parameters<typeof runtime.renderToString>[1]}};
  new Function("require","exports",heroCode)(require,heroModule.exports);
  renderHero=props=>container.renderToString(heroModule.exports.default,{props});
});

const base = { asset: "diagram", alt: "部品の断面" };
const classes = (html: string) => [...html.matchAll(/class="(article-figure__[^"]+)"/gu)].map(match => match[1]!.split(" ")[0]);

describe("Site Figure standard", () => {
  it("loads module CSS for a standalone Figure at every existing width", async () => {
    const layout = await readFile(new URL("../../layouts/ContentLayout.astro", import.meta.url), "utf8");
    // Execute the layout's real selection expression against rendered Figure
    // markup, so a new class cannot silently miss the conditional stylesheet.
    const selection = layout.match(/const hasArticleModules = (\/[^\r\n]+\/u)\.test\(bodyHtml\);/u);
    if (!selection) throw new Error("Layout module stylesheet selector missing");
    const selectsCss = new Function("bodyHtml", `return ${selection[1]}.test(bodyHtml);`) as (html: string) => boolean;
    expect(layout).toContain('articleModulesCssHref={hasArticleModules ? articleModulesCssHref : undefined}');
    expect(selectsCss("<p>通常本文のみ</p>")).toBe(false);
    for (const width of ["content", "wide", "full", "compact"]) {
      expect(selectsCss(await render({ ...base, width, title: "図題", caption: "説明", note: "条件" })), width).toBe(true);
    }
  });

  it("preserves caption-only figures and omits absent metadata", async () => {
    const html = await render({ ...base, caption: "既存の説明" });
    expect(html).toContain('<p class="article-figure__caption">既存の説明</p>');
    expect(classes(html)).toEqual(["article-figure__caption"]);
    expect(await render(base)).not.toContain("<figcaption");
    expect(await render({ ...base, width: "compact" })).toContain("article-compact-figure");
  });

  it("uses one native caption after media and controls, with ordered semantic blocks", async () => {
    const html = await render({ ...base, title: "短い図題", caption: "図の読み方", note: "条件の説明", credit: "作図：著者", sourceUrl: "https://example.test/source" });
    expect(classes(html)).toEqual(["article-figure__title", "article-figure__caption", "article-figure__note", "article-figure__source"]);
    expect(html).toContain('<strong class="article-figure__title">短い図題</strong>');
    expect(html).toContain('<span>補足：</span>条件の説明');
    const tree = parseFragment(html);
    const figure = tree.childNodes.find(node => node.nodeName === "figure");
    if (!figure || !("childNodes" in figure)) throw new Error("Native figure missing");
    expect(figure.childNodes.filter(node => node.nodeName !== "#text").map(node => node.nodeName)).toEqual(["picture", "button", "figcaption"]);
    expect(html.match(/<figcaption>/gu)).toHaveLength(1);
    expect(html).not.toMatch(/<h[1-6]|aria-hidden|role=|<script/iu);
  });

  it.each([{ credit: "撮影：著者" }, { sourceUrl: "https://example.test/source" }, { credit: "著者", sourceUrl: "https://example.test/source" }])("keeps attribution visible alone: %j", async props => {
    const html = await render({ ...base, ...props });
    expect(classes(html)).toEqual(["article-figure__source"]);
    if (props.credit) expect(html).toContain(props.credit);
    if (props.sourceUrl) expect(html).toContain('<a href="https://example.test/source" rel="external noopener noreferrer">出典</a>');
  });

  it("escapes every text field without adding headings or markup from author text", async () => {
    const text = '<script>alert("x")</script> & <em>文字</em>';
    const html = await render({ ...base, title: text, caption: text, note: text, credit: text });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<em>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain('alt="部品の断面"');
  });

  it.each(["title", "note"])("validates %s consistently at the schema, MDX and renderer boundary", async key => {
    for (const value of ["", " \t\n　", "x".repeat(key === "title" ? 121 : 601)]) {
      expect(figureModulePropsSchema.safeParse({ ...base, [key]: value }).success).toBe(false);
      expect(validatePortableMdx(`<Figure asset="diagram" alt="断面" ${key}="${value}" />`).length).toBeGreaterThan(0);
      await expect(render({ ...base, [key]: value })).rejects.toThrow();
    }
    const limit = key === "title" ? 120 : 600;
    expect(figureModulePropsSchema.safeParse({ ...base, [key]: "x".repeat(limit) }).success).toBe(true);
    expect(validatePortableMdx(`<Figure asset="diagram" alt="断面" ${key}=" 説明 " />`)).toEqual([]);
    const html = await render({ ...base, [key]: " 説明 " });
    expect(html).toContain(key === "title" ? '>説明</strong>' : '</span>説明</p>');
    expect(classes(html)).toEqual([`article-figure__${key}`]);
  });

  it("retains the approved literal-prop and HTTPS source contract", () => {
    expect(validatePortableMdx('<Figure asset="diagram" alt="断面" title={value} />').join(" ")).toContain("expressions are not portable");
    expect(validatePortableMdx('<Figure asset="diagram" alt="断面" note="条件" style="color:red" />').length).toBeGreaterThan(0);
    expect(figureModulePropsSchema.safeParse({ ...base, sourceUrl: "http://example.test/" }).success).toBe(false);
  });
});

describe("registry credit in real hero and Figure templates", () => {
  it("uses the same required credit and license below hero and inline without changing caption", async () => {
    testContext.rights=[{...creditRights,attributionText:"合成製作者。承認・提携を意味しません。",licenseId:"Fixture license",licenseUrl:"https://example.test/LICENSE",sourceUrl:"https://example.test/source"}];
    const figure=await render({...base,title:"元の図題",caption:"元の説明",credit:testContext.rights[0]!.attributionText,sourceUrl:"https://example.test/source"});
    const hero=await renderHero({asset:"diagram",contentId:creditContentId});
    for(const html of [figure,hero]){
      expect(html.match(/<figcaption/gu)).toHaveLength(1);
      expect(html.match(/合成製作者。/gu)).toHaveLength(1);
      expect(html.match(/href="https:\/\/example.test\/source"/gu)).toHaveLength(1);
      expect(html).toContain("Fixture license（利用条件）");
      expect(html).not.toMatch(/<script|aria-hidden|tabindex=/u);
    }
    expect(figure).toContain("元の図題");
    expect(figure).toContain("元の説明");
    expect(hero).toContain('fetchpriority="high"');
    expect(hero.indexOf("<figcaption")).toBeGreaterThan(hero.indexOf("</picture>"));
  });
  it("omits empty hero caption and rejects missing rights in both templates",async()=>{
    expect(await renderHero({asset:"diagram",contentId:creditContentId})).not.toContain("<figcaption");
    testContext.rights=[];
    await expect(render(base)).rejects.toThrow("RIGHTS_NOT_UNIQUE");
    await expect(renderHero({asset:"diagram",contentId:creditContentId})).rejects.toThrow("RIGHTS_NOT_UNIQUE");
  });
});
