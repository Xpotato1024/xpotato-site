import { describe, expect, it } from "vitest";
import {
  convertPrimeFactorizerBody,
  htmlFragmentToPortableMarkdown,
  stripLeadingTitleHeading,
} from "./phase4-content-materialization.js";

describe("Phase 4 portable content materialization", () => {
  it("converts static LegacyHtml structure without retaining media locators", () => {
    const html = [
      "<h2>目的</h2>",
      "<p>本文 <strong>強調</strong> と <a href=\"https://example.com/\">参照</a>。</p>",
      "<ul><li><strong>項目A</strong>：説明</li><li>項目B</li></ul>",
      "<pre><code class=\"language-bash\">echo ok\n</code></pre>",
      "<p><img src=\"/wp-content/uploads/example.png\" alt=\"legacy\" /></p>",
    ].join("\n");
    const markdown = htmlFragmentToPortableMarkdown(html);
    expect(markdown).toContain("## 目的");
    expect(markdown).toContain("**強調**");
    expect(markdown).toContain("[参照](https://example.com/)");
    expect(markdown).toContain("- **項目A**：説明");
    expect(markdown).toContain("```bash\necho ok\n```");
    expect(markdown).not.toContain("wp-content");
    expect(markdown).not.toContain("<img");
  });

  it("fails closed for an unsupported executable HTML element", () => {
    expect(() => htmlFragmentToPortableMarkdown("<script>alert(1)</script>")).toThrow(/Unsupported LegacyHtml element/);
  });

  it("replaces the legacy React island with the stable Demo module binding", () => {
    const source = [
      "import PrimeFactorizer from \"../../components/app/PrimeFactorizer\";",
      "",
      "本文です。",
      "",
      "<div class=\"not-prose\">",
      "  <PrimeFactorizer client:visible />",
      "</div>",
    ].join("\n");
    const converted = convertPrimeFactorizerBody(source);
    expect(converted).toContain('<Demo module="prime-factorizer" title="素因数分解を試す" />');
    expect(converted).not.toContain("<PrimeFactorizer");
    expect(converted).not.toContain("<div");
  });

  it("removes only an exact duplicate leading title heading", () => {
    expect(stripLeadingTitleHeading("# 同じ題名\n\n本文", "同じ題名")).toEqual({ source: "本文", removed: true });
    expect(stripLeadingTitleHeading("# 別の見出し\n\n本文", "同じ題名")).toEqual({ source: "# 別の見出し\n\n本文", removed: false });
  });
});
