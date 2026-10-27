import type { BrowserToolUiCapabilities } from "@xpotato/content-contracts";
// Only validated, selected-bundle metadata enters this formatter. Do not infer missing modes or routes.
export function formatToolCapabilities(c: BrowserToolUiCapabilities) {
 const route=c.smallInputRoute,mode=route?c.modes.find(m=>m.id===route.modeId):undefined;
 return {notation:"入力表記は"+c.input.maxTextLength.toLocaleString("ja-JP")+"文字まで。数値の上限はモードごとに異なります。",
 modes:c.modes.map(m=>m.label+"：最大"+m.maxDigits+"桁、かつ"+m.maxBits+"bit以下。時間上限は最大"+m.timeBudgetMaxMs/1000+"秒。"),
 smallInputRoute:route&&mode?"2^"+route.exclusiveUpperPowerOfTwo+"未満の小入力は"+mode.label+"の経路を使い、その時間上限は最大"+route.timeBudgetMaxMs/1000+"秒です。選択したモードの最大値とは異なる場合があります。":null,
 disclaimer:"これらは入力・設定の上限で、分解完了や実使用量を保証する値ではありません。"};
}
