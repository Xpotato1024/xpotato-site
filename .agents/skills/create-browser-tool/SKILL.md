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
5. Worker/WASMやコピーが必要なら共通 bounded-browser-v2 の必要capability・有限予算・固定資産を宣言し、取消/unmount/ready後通信/実distを試験する。旧prime v0.1.0専用profileをコピーせず、CSP/公開承認を推定しない。既存prime GUIはtoolkit sourceで編集し、session/lease/予算/precisionを維持する。
6. 作成契約の視覚・focus規約と既存ページを照合する。反復する角丸カードを避け、入力枠・focus・主要操作の視認性は維持する。16px以上の入力、show/hideとscroll、キーボードを確認し、ピンチ拡大を禁止しない。実画面の前後を同じ条件で撮影し、emulationと実機を区別する。
7. 利用者が指定した終了範囲を守る。生成・検査だけの依頼でadopt/公開へ進まない。文字数など精度定義に曖昧さがあれば既存core/testを確認して記録する。正本のreview・2clean build後、導入まで依頼されていれば browser-tools:install のplan/apply/checkへ進む。掲載先には本人が割り当てたContentId、slug/title/description、既存taxonomy、draft:trueを指定し、個別wrapper/registry/lockを手書きしない。管理済み更新は現在artifact hashをreplace-artifactで固定。旧手動登録は自動上書きせず移行を別途設計する。applyはローカル下書き登録とpackage/lockまで。続けて共通の npm ci --ignore-scripts（cacheが揃えば --offline）で依存実体を反映して検証/buildする。実dist受入・公開は別。生成成功・artifact check・合成fixture・emulationを、source reviewや公開受入の代わりにしない。
8. source、固定commit/artifact、commandと結果、未確認の実機/失敗/残件を記録する。Draft PRまでの依頼からmerge/release/npm/deploy許可を推定しない。

既存証拠はroot workflowに従い再利用する。正本と歴史資料が食い違えば歴史資料を実装命令にせず、差を報告して正本に合わせる。
