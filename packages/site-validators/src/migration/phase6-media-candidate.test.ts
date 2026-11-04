import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import sharp from "sharp";
import { bundledOutlineFont } from "@xpotato/media-ingest";
import {
  renderPhase6BlogHeroSvg,
  renderPhase6BlogSocialSourceSvg,
  renderPhase6ConohaSshDiagramSvg,
  layoutPhase6SocialTitle,
  phase6SocialCardProfile,
} from "./phase6-media-candidate.js";

const expectNoExternalResourceReference = (source: string): void => {
  expect(source).not.toMatch(/\b(?:href|src)=["']https?:/iu);
  expect(source).not.toMatch(/url\(\s*["']?https?:/iu);
};

describe("Phase 6 deterministic media sources", () => {
  it("generates byte-stable hero SVG from ContentId only", () => {
    const id = "4ccd039f-2625-4f2b-83bb-fe248906ef96";
    const first = renderPhase6BlogHeroSvg(id);
    const second = renderPhase6BlogHeroSvg(id);
    expect(first).toBe(second);
    expect(first).toContain('width="1600" height="900"');
    expect(first).toContain('xmlns="http://www.w3.org/2000/svg"');
    expectNoExternalResourceReference(first);
  });

  it("escapes social-card metadata rather than emitting active markup", () => {
    const source = renderPhase6BlogSocialSourceSvg(
      "4ccd039f-2625-4f2b-83bb-fe248906ef96",
      'A <B> & "C"',
      "software",
    );
    expect(source).toContain("A &lt;B&gt; &amp; &quot;C&quot;");
    expect(source).not.toContain("<script");
    expect(source).not.toMatch(/<text\b|font-family=|<tspan\b/u);
    expect(source).toContain("blog-social-card-outline-v2");
    expectNoExternalResourceReference(source);
  });

  it("outlines Japanese, mixed text and a long heading without truncation or fallback", async () => {
    const font = bundledOutlineFont(resolve("."));
    for (const title of ["日本語の漢字・ひらがな・カタカナ、句読点。", "AnythingLLM の RAG が 1 回目の成功後に壊れたときに見直した Qdrant 設定", "長い日本語見出しの回帰テスト".repeat(7)]) {
      const layout = layoutPhase6SocialTitle(title, font.width);
      expect(layout.lines.join("")).toBe(title);
      expect(layout.fontSize).toBeGreaterThanOrEqual(phase6SocialCardProfile.minFontSize);
      for (const line of layout.lines) expect(font.width(line, layout.fontSize)).toBeLessThanOrEqual(1008);
      for (const line of layout.lines.slice(1)) expect(line).not.toMatch(/^[、。，）」』】]/u);
      const svg = renderPhase6BlogSocialSourceSvg("4ccd039f-2625-4f2b-83bb-fe248906ef96", title, "日本語");
      expect(svg).not.toMatch(/<text\b|<image\b|<use\b|href=|url\(/u);
      const a = await sharp(Buffer.from(svg)).png().toBuffer();
      expect(a.equals(await sharp(Buffer.from(svg)).png().toBuffer())).toBe(true);
      const { data, info } = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info).toMatchObject({ width: 1200, height: 630, channels: 3 });
      let ink = 0;
      for (let y = 130; y < 510; y++) for (let x = 0; x < 1200; x++) {
        const i = (y * 1200 + x) * 3;
        if (data[i] === 248 && data[i + 1] === 250 && data[i + 2] === 252) {
          ink++;
          expect(x).toBeGreaterThanOrEqual(96);
          expect(x).toBeLessThan(1105);
        }
      }
      expect(ink).toBeGreaterThan(2000);
    }
  }, 30000);

  it("rejects missing glyphs and excessive text instead of silently emitting tofu or ellipsis", () => {
    for (const title of ["絵文字 🫠", "不可視\u200b文字", "", "長".repeat(181), "長".repeat(180)]) {
      expect(() => renderPhase6BlogSocialSourceSvg("4ccd039f-2625-4f2b-83bb-fe248906ef96", title, "software")).toThrow(/^CARD_/u);
    }
    expect(() => bundledOutlineFont(resolve("missing-font-fixture"))).toThrow();
  });

  it("keeps long Latin words and closing punctuation at valid line boundaries", () => {
    const font = bundledOutlineFont(resolve("."));
    const title = "Gale で CPU/GPU の加速経路を比較し、次の優先順位を決める話";
    const { lines } = layoutPhase6SocialTitle(title, font.width);
    expect(lines.join("")).toBe(title);
    expect(lines.slice(1).every(line => !/^[、。，）」』】]/u.test(line))).toBe(true);
    const mixed = layoutPhase6SocialTitle("日本語の見出しで SQLite と Qdrant collection を折り返す".repeat(2), font.width);
    expect(mixed.lines.join("")).toContain("SQLite と Qdrant collection");
    expect(mixed.lines.every(line => !/S$/u.test(line))).toBe(true);
  });

  it("uses a provider-neutral conceptual SSH diagram for the ConoHa replacement", () => {
    const source = renderPhase6ConohaSshDiagramSvg();
    expect(source).toContain("SSH public key authentication");
    expect(source).toContain("Private key stays here");
    expect(source).toContain("Conceptual diagram — not a reproduction of any provider control panel");
    expect(source).not.toContain("cp.conoha.jp");
    expect(source).not.toContain("19EBD197");
    expectNoExternalResourceReference(source);
  });
});
