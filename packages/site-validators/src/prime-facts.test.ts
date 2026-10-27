import { describe, it, expect } from "vitest";
import { browserToolUiCapabilitiesSchema } from "@xpotato/content-contracts";
import { validatePrimeFacts } from "./prime-facts.js";
const c = browserToolUiCapabilitiesSchema.parse({schemaVersion:1,kind:"integer-factorization",input:{maxTextLength:4096,minimum:"0",scientificNotation:true},defaultMode:"standard",completionGuaranteed:false,modes:[{id:"standard",label:"通常",uiLabel:"通常",maxDigits:39,maxBits:128,timeBudgetMaxMs:60000},{id:"optimized",label:"高精度",uiLabel:"高精度",maxDigits:100,maxBits:332,timeBudgetMaxMs:600000}]});
const body = '<section data-prime-facts><h2>このツールでできること</h2><p>入力欄に長い値を貼り付けられることと、計算を受け付けることは別です。4,096文字、39桁、かつ128bit以下・60秒。100桁、かつ332bit以下・600秒。完了を保証せず、素数証明ではありません。公開版と異なる測定版。</p></section>';
const achievement = '<aside data-prime-achievement>過去の実験版の1試行。現行公開版の速度保証ではありません。</aside>';
const page = (value = body) => '<main>' + achievement + '<astro-island>入力部</astro-island>' + value + '</main>';
describe("visible selected-release facts", () => {
  it("accepts readable limits after the tool", () => expect(validatePrimeFacts(page(), c)).toEqual([]));
  it("rejects explanations moved into closed help, hidden nodes or the island", () => {
    for (const wrapper of ['<details>BODY</details>','<div hidden>BODY</div>','<astro-island>BODY</astro-island>']) expect(validatePrimeFacts(page(wrapper.replace("BODY", body)), c)).toContain("prime facts: always-visible acceptance explanation missing");
  });
  it("rejects stale bits, decimal digits, raw text length or time budgets", () => {
    for (const [before,after] of [["332bit","333bit"],["100桁","101桁"],["4,096文字","100文字"],["600秒","6000秒"]]) expect(validatePrimeFacts(page(body.replace(before!,after!)), c).length).toBeGreaterThan(0);
  });
  it("keeps the historical achievement qualified and before the input", () => {
    expect(validatePrimeFacts(page().replace(achievement, ""), c)).toContain("prime facts: qualified achievement must precede the tool");
    expect(validatePrimeFacts(page().replace("過去の実験版の1試行。", "現在の公開版。"), c)).toContain("prime facts: qualified achievement must precede the tool");
  });
  it("rejects missing selected metadata and unqualified benchmark or superiority claims", () => {
    expect(validatePrimeFacts(page(), undefined)).toContain("prime facts: selected capabilities missing");
    expect(validatePrimeFacts(page(body.replace("異なる測定版","同じ測定版")), c)).toContain("prime facts: historical benchmark scope missing");
    expect(validatePrimeFacts(page(body+"<p>世界最速</p>"), c)).toContain("prime facts: unsupported superiority or completion claim");
  });
});
