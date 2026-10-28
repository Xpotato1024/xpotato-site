import { describe, expect, it } from "vitest";
import { validatePortableMdx } from "./index.js";

const example = `
<DiagnosticList>
  <DiagnosticItem symptom="曲げると折れる" check="外周と造形方向">
    根元に力が集中していないか見てみましょう。
  </DiagnosticItem>
  <DiagnosticItem symptom="上から押すとへこむ" check="上面の厚さ">
    内部の支えも確認します。
  </DiagnosticItem>
</DiagnosticList>
`;

describe("portable diagnostic blocks", () => {
  it("accepts nested literal-prop structures as portable MDX", () => {
    expect(validatePortableMdx(example)).toEqual([]);
  });
  it("rejects a diagnostic item outside its list", () => {
    expect(validatePortableMdx('<DiagnosticItem symptom="折れる" check="外周">確認</DiagnosticItem>').join("\n"))
      .toMatch(/directly inside DiagnosticList/u);
  });
  it("rejects empty lists and missing required details", () => {
    expect(validatePortableMdx("<DiagnosticList></DiagnosticList>").join("\n")).toMatch(/at least one/u);
    expect(validatePortableMdx('<DiagnosticList><DiagnosticItem symptom="折れる">確認</DiagnosticItem></DiagnosticList>').join("\n"))
      .toMatch(/approved schema/u);
  });
  it("rejects dynamic JS expressions in content props", () => {
    const bad = '<DiagnosticList><DiagnosticItem symptom={state} check="外周">確認</DiagnosticItem></DiagnosticList>';
    expect(validatePortableMdx(bad).join("\n")).toMatch(/expressions are not portable/u);
  });
});
