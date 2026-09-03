import { describe, expect, it } from "vitest";
import {
  renderPhase6BlogHeroSvg,
  renderPhase6BlogSocialSourceSvg,
  renderPhase6ConohaSshDiagramSvg,
} from "./phase6-media-candidate.js";

describe("Phase 6 deterministic media sources", () => {
  it("generates byte-stable hero SVG from ContentId only", () => {
    const id = "4ccd039f-2625-4f2b-83bb-fe248906ef96";
    const first = renderPhase6BlogHeroSvg(id);
    const second = renderPhase6BlogHeroSvg(id);
    expect(first).toBe(second);
    expect(first).toContain('width="1600" height="900"');
    expect(first).not.toContain("http://");
    expect(first).not.toContain("https://");
  });

  it("escapes social-card metadata rather than emitting active markup", () => {
    const source = renderPhase6BlogSocialSourceSvg(
      "4ccd039f-2625-4f2b-83bb-fe248906ef96",
      'A <B> & "C"',
      "software",
    );
    expect(source).toContain("A &lt;B&gt; &amp; &quot;C&quot;");
    expect(source).not.toContain("<script");
    expect(source).toContain("xpotato.net");
  });

  it("uses a provider-neutral conceptual SSH diagram for the ConoHa replacement", () => {
    const source = renderPhase6ConohaSshDiagramSvg();
    expect(source).toContain("SSH public key authentication");
    expect(source).toContain("Private key stays here");
    expect(source).toContain("Conceptual diagram — not a reproduction of any provider control panel");
    expect(source).not.toContain("cp.conoha.jp");
    expect(source).not.toContain("19EBD197");
  });
});
