// SPDX-License-Identifier: AGPL-3.0-only
import {SITE_CAPABILITIES,SITE_MODES} from './capabilities.mjs';
// Explanation only; input parsing and resource selection remain in their policies.
export const inputGuidance=Object.freeze([
 {title:'入力形式',text:'0以上の整数と、整数になる科学表記（例：3.2e1）に対応します。先頭の0は値の桁数に含めません。入力表記は'+SITE_CAPABILITIES.input.maxTextLength+'文字までで、超過は切り詰めずエラーにします。'},
 {title:'計算範囲',text:'通常の受付は最大'+SITE_MODES.standard.maxDigits+'桁・'+SITE_MODES.standard.maxBits+'bitです。小入力（2^128未満）は既存経路を使い、以後は小因子探索・ECM・SIQSを残る値と予算で選びます。高精度は最大'+SITE_MODES.optimized.maxDigits+'桁、かつ'+SITE_MODES.optimized.maxBits+'bit以下、大メモリは121桁・400bit以下です。333〜400bitのSIQSは実験的で全分解未検証です。受付上限は完走保証ではなく、桁数だけで所要時間は分かりません。'},
 {title:'実行資源と端末の負荷',items:[
  '通常：自動配分の有限探索で最大60秒。NativeはWASMなし、ECMは64 MiB、332bit以下の後段SIQSは設定予算内で動きます。各段階で時間上限をリセットしません。',
  '高精度：自動配分は最大2 Worker。手動配分は最大6 Worker・WASM予算128〜768 MiB・10分で、予算に収まる組み合わせだけを使えます。',
  '大メモリ：明示的な手動設定で最大5 Worker・WASM予算1536 MiB・1時間。Worker数は集約役を含む総数です。'
 ],text:'これらは設定・計画の上限で、実使用量の測定値ではありません。WASMの上限はブラウザ全体のRAM上限ではなく、タブ終了を防ぐ保証もありません。'},
 {title:'結果の扱い',text:'進捗バーは工程内の割合で、全体の完了率や残り時間ではありません。未分解・未証明を区別します。同じページの計算は1件だけです。計算は端末内で行い、ツールから入力・結果を外部へ送信したり、履歴として保存したりしません。コピーは操作したときだけ行います。'}
]);
