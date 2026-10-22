---
name: create-browser-tool
description: xpotato-site向けブラウザ完結ツールの独立sourceを生成・編集・検査するときに使う。GUI/core/adapter構造、manifest、固定版取り込みを共通契約に合わせる。記事作成や一般のChatGPT/MCPプラグイン作成には使わない。
---

# ブラウザツールを作る

1. root AGENTS.md と [作成契約](../../../docs/contracts/browser-tool-authoring.md) を読み、source repoとsite hostの責務を確認する。runtime上限・peer版・manifestをこのSkillへコピーしない。
2. toolId、目的、入力/結果モデル、利用許諾とLICENSE/NOTICEの実ファイルを確認する。既存sourceならrepo/commitとprofileを先に調べ、再生成で上書きしない。
3. 新規の軽量同期ツールは共通コマンドを使う。
   npm run browser-tools:author -- create --directory <存在しない絶対path> --id <id> --title <表示名> --license <許諾されたSPDX> --license-file <絶対path> --notice-file <絶対path>
   別templateやcheckerを作らない。計算はcore、GUIはui、host接続はadapter。入力精度・UTF-8上限・出力上限を試験する。
4. 指定toolchainでlockを作りreviewし、npm ci --ignore-scripts、npm test、fresh外部directoryへの npm run build -- <output>。siteで npm run browser-tools:author -- check --artifact <output>。
5. Worker/WASM等が必要なら権限を広げず、新profile審査の必要事項を契約に沿って示す。prime専用profileを他toolIdへコピーしない。既存prime GUIはtoolkit sourceで編集し、session/lease/予算/precisionを維持する。
6. 利用者が指定した終了範囲を守る。生成・検査だけの依頼でadopt/公開へ進まない。文字数など精度定義に曖昧さがあれば既存core/testを確認して記録する。正本のreview・2clean build・verify/adopt/select・実dist受入へ進む。生成成功・artifact check・合成fixture・emulationを、source reviewや公開受入の代わりにしない。
7. source、固定commit/artifact、commandと結果、未確認の実機/失敗/残件を記録する。Draft PRまでの依頼からmerge/release/npm/deploy許可を推定しない。

既存証拠はroot workflowに従い再利用する。正本と歴史資料が食い違えば歴史資料を実装命令にせず、差を報告して正本に合わせる。
