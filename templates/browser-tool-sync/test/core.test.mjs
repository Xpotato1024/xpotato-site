import test from "node:test";
import assert from "node:assert/strict";
import {convert} from "../src/core/convert.mjs";
test("Unicode code points and the UTF-8 boundary",()=>{
  assert.equal(convert("🍟あ"),"文字数: 2");
  assert.equal(convert("a".repeat(__INPUT_BYTES__)),"文字数: __INPUT_BYTES__");
  assert.throws(()=>convert("あ".repeat(1366)),/__INPUT_BYTES__/);
});
