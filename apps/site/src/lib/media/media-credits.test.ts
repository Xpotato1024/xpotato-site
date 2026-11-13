import { describe, expect, it } from "vitest";
import { resolveMediaCredits, renderMediaCredits } from "./media-credits.js";
import { creditContentId, creditRegistry, creditRights, creditContext } from "./media-credits.test-fixtures.js";
import { renderMarkdownMedia } from "../content/markdown-media.js";
import { parseFragment } from "parse5";

const base = { contentId: creditContentId, registry: creditRegistry, assetId: "diagram", rights: [creditRights] };
const licensed = { ...creditRights, basis: "licensed" as const, ownerOrSource: "Synthetic artist",
  attributionText: "図版：合成スタジオ。掲載先との提携・承認を示しません。",
  sourceUrl: "https://example.test/source", licenseId: "BSD-3-Clause", licenseUrl: "https://example.test/LICENSE",
  notes: ["private operator evidence must never render"] };
const render = (patch = {}) => renderMediaCredits(resolveMediaCredits({ ...base, ...patch }));

describe("registry media credit boundary", () => {
  it("keeps absent optional credits empty and emits only approved public display fields", () => {
    expect(render()).toBe("");
    const html = render({ rights: [licensed] });
    expect(html).toContain(licensed.attributionText);
    expect(html).toContain('href="https://example.test/LICENSE" rel="external noopener noreferrer">BSD-3-Clause（利用条件）');
    expect(html).not.toMatch(/private operator|Synthetic artist|confirmedBy|script|target=/u);
    expect(html).not.toContain("AS IS");
    expect(render({ rights: [{ ...creditRights, licenseUrl: "https://example.test/terms" }] })).toContain(">利用条件</a>");
  });
  it("deduplicates exact text and URLs only, retaining distinct required attribution and source", () => {
    const exact = render({ rights: [licensed], credit: licensed.attributionText, sourceUrl: licensed.sourceUrl });
    expect(exact.split(licensed.attributionText)).toHaveLength(2);
    expect(exact.match(/href=/gu)).toHaveLength(2);
    const distinct = render({ rights: [licensed], credit: "図版：合成スタジオ。", sourceUrl: "https://example.test/other" });
    expect(distinct).toContain("図版：合成スタジオ。</span>");
    expect(distinct.match(/href=/gu)).toHaveLength(3);
    const shared = render({ rights: [{ ...licensed, sourceUrl: licensed.licenseUrl }], sourceUrl: licensed.licenseUrl });
    expect(shared.match(/href=/gu)).toHaveLength(1);
    expect(shared).toContain("出典・BSD-3-Clause（利用条件）");
  });
  it("escapes plain credit text rather than treating it as markup", () => {
    const html = render({ rights: [{ ...creditRights, attributionText: '<script>alert("x")</script> & <em>text</em>' }] });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<script>");
  });
  it("fails closed for missing, duplicate, unconfirmed, cross-content and incomplete license records", () => {
    for (const rights of [undefined, [], [creditRights, creditRights], [{ ...creditRights, publicationAuthorized: false }],
      [{ ...creditRights, basis: "unknown", publicationAuthorized: false }], [{ ...creditRights, rightsId: "other" }],
      [{ ...creditRights, basis: "licensed" }]]) expect(() => render({ rights })).toThrow();
    expect(() => render({ contentId: "8793f6f7-98d4-4ee5-a29f-9302a0a94808" })).toThrow("CONTENT_ID");
    expect(() => render({ assetId: "other" })).toThrow("NOT_UNIQUE_ACTIVE");
    expect(() => render({ registry: { ...creditRegistry, assets: [...creditRegistry.assets, ...creditRegistry.assets] } })).toThrow("NOT_UNIQUE_ACTIVE");
  });
  it("keeps legacy reference overlays separate from production and incomplete supplied rights", () => {
    expect(render({ rights: undefined, referenceOnly: true, credit: "参考資料", sourceUrl: "https://example.test/reference" })).toContain("参考資料");
    expect(() => render({ rights: undefined, referenceOnly: false })).toThrow("RIGHTS_NOT_UNIQUE");
    expect(() => render({ rights: [], referenceOnly: true })).toThrow("RIGHTS_NOT_UNIQUE");
    expect(() => render({ rights: [{ ...creditRights, publicationAuthorized: false }], referenceOnly: true })).toThrow("UNCONFIRMED");
  });
  it.each(["javascript:alert(1)", "http://example.test/source", "https://user:secret@example.test/source",
    "https://localhost/source", "https://127.0.0.1/source", "https://2130706433/source", "https://[::1]/source",
    "https://machine.local/source", "https://internal/source", "https://example.test/source?token=fixture",
    "https://example.test/source?X-Amz-Signature=fixture", "https://example.test/source#access_token=fixture",
    "https://example.test/ source", "https://example.test/\\source"] )("rejects unsafe URL metadata %s", url => {
    for (const key of ["sourceUrl", "licenseUrl"]) expect(() => render({ rights: [{ ...creditRights, [key]: url }] })).toThrow();
    expect(() => render({ sourceUrl: url })).toThrow();
  });
  it.each(["C:\\Users\\private\\source.png", "/home/alice/private.png", "file:///private/photo",
    "api_key=fixture", "https://example.test/source?sig=fixture"])("rejects private text %s", attributionText => {
    expect(() => render({ rights: [{ ...creditRights, attributionText }] })).toThrow();
  });
  it("retains safe source queries and exact URLs", () => {
    const url = "https://example.test/view?model=github:synthetic/model.xml#overview";
    expect(render({ rights: [{ ...creditRights, sourceUrl: url }] })).toContain('href="' + url + '"');
  });
  it("validates animation poster rights and deduplicates shared attribution", () => {
    const registry = structuredClone(creditRegistry), poster = { ...registry.assets[0]!, assetId: "poster", rightsRef: "poster-rights" };
    registry.assets[0]!.delivery = { ...registry.assets[0]!.delivery, mode: "animated", posterAssetId: "poster" };
    registry.assets.push(poster);
    expect(() => render({ registry })).toThrow("RIGHTS_NOT_UNIQUE");
    const rights = [licensed, { ...licensed, rightsId: "poster-rights" }];
    expect(render({ registry, rights }).split(licensed.attributionText)).toHaveLength(2);
    expect(() => render({ registry, rights: [licensed, { ...rights[1], publicationAuthorized: false }] })).toThrow();
  });
  it("adds credit to ordinary Markdown media without editing alt or creating nested paragraphs", () => {
    const html = renderMarkdownMedia('<p>本文 <img src="media:diagram" alt="元の代替説明"> 続き</p>', { ...creditContext, rights: [licensed] });
    expect(html).toContain('alt="元の代替説明"');
    expect(html).toContain("media-credit");
    const tree = parseFragment(html);
    expect(tree.childNodes.filter(node => node.nodeName !== "#text").map(node => node.nodeName)).toEqual(["p"]);
    expect(() => renderMarkdownMedia('<p><img src="media:diagram"></p>', { ...creditContext, rights: [] })).toThrow();
  });
});

describe("additional metadata and Markdown boundaries",()=>{
  it("rejects a future confirmation and keeps attribution outside an existing image link",()=>{
    expect(()=>resolveMediaCredits({...base,rights:[{...creditRights,confirmedAt:"2999-01-01T00:00:00Z"}]})).toThrow("UNCONFIRMED");
    const html=renderMarkdownMedia('<p><a href="https://example.test/original"><img src="media:diagram" alt="元の画像"></a></p>',{...creditContext,rights:[licensed]});
    expect(html.indexOf('class="media-credit"')).toBeGreaterThan(html.indexOf("</a>"));
    const tree=parseFragment(html);
    expect(tree.childNodes.filter(n=>n.nodeName!=="#text").map(n=>n.nodeName)).toEqual(["p"]);
  });
});
