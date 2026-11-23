---
name: create-browser-tool
description: xpotato-site向けブラウザツールを目的・利用者・入出力の整理から独立source、共通UI、説明ページ、固定版取り込み、分類・SEO、本人限定previewと配備準備まで一貫して作成・更新する入口。記事執筆や一般のChatGPT/MCPプラグイン作成、公開承認の代行には使わない。
---

# ツールを完成させる

## 最初に読む

root AGENTS.md、[一貫制作手順](../../../docs/operations/content-production.md)、[共通構成](../../../docs/content/page-composition.md)、[作成契約](../../../docs/contracts/browser-tool-authoring.md)を読み、source repoとSite hostの責務を確認する。正確なruntime上限・peer版・manifestは契約/CLIが所有し、このSkillへ複製しない。

## 1. 目的・利用者・ゴール

[内部tool brief](../../../templates/content/tool-brief.md)の必要分を既存taskメモへ記す。用途、利用者、入力と結果、単位・精度、上限、読者が完了したと判断する状態を定める。既知の情報を再質問せず、外部情報や既存core/testで確認できることは調べる。

toolId、既存ContentId/URL、source repo/commit、採用版、変更対象外、利用許諾とLICENSE/NOTICEの実ファイルを確認する。新規・更新を区別し、既存sourceを再生成で上書きしない。依頼が生成だけ・Draft PRまでならその終了範囲を守る。

## 2. 構造とUXを設計

計算はcore、操作画面はUI、host接続はadapterへ分ける。必要な入力、主要操作、処理中、結果、空、エラー、取消・再実行を定義する。不要な状態・通信・保存を雛形の都合で増やさない。

掲載ページは短い用途→入力/操作→結果→使い方・実例→制約→採用版/利用条件/対応ソースの順を基本にする。長い導入やheroで操作を下へ押し下げない。[AI回答での発見性](../../../docs/operations/answer-discoverability.md)に沿い、製品名を知らない人が「何を実行したいか」「何を入力できるか」「何が得られるか」「制約は何か」と尋ねたときの回答を本文と操作導線へ対応させる。title/description、分類、技術/目的タグ、日付、必要な式・図・グラフを同時に設計する。

font、見出し、入力、focus、主要操作、補足は共通token/公開CSS APIを使う。Siteからvendor内部selectorを上書きしない。図や数式は[技術ビジュアル](../../../docs/operations/technical-visuals.md)の静的経路を基本にし、対話グラフが本当に必要な場合だけ既存Interactive Registryと予算を通す。

## 3. 正本で実装・試験

新規の軽量同期ツールは既存生成器を使う。

```sh
npm run browser-tools:author -- create --directory <存在しない絶対path> --id <id> --title <表示名> --license <許諾されたSPDX> --license-file <絶対path> --notice-file <絶対path>
```

別template/checker/loaderを作らない。既存sourceはその正本を編集する。指定toolchainでlockを作成・reviewし、生成sourceで `npm ci --ignore-scripts`、`npm test`、新しい外部directoryへ `npm run build -- <output>`。Siteで `npm run browser-tools:author -- check --artifact <output>` を行う。

入力精度、UTF-8/出力上限、境界値・不正入力、既知の正解を検査する。Worker/WASM/clipboardが必要なら共通 bounded-browser-v2 の必要capability・有限予算・固定資産を宣言し、取消/unmount/pagehide/再実行/ready後通信/実distを試験する。旧prime専用profileを新toolへコピーしない。

## 4. 説明と操作画面を完成

自然な日本語で、何を入力し、結果をどう読み、どの条件では使えないかを示す。想定質問に直接答える短い説明と実際に使える入力例を静的HTMLに含め、過剰なFAQやAIに引用を促す命令を追加しない。測定していない時間・精度を保証せず、実測と上限を分ける。サンプルは実coreで確認し、因子等の意味単位を表示上で潰さない。

反復する角丸カードを避け、文字階層・余白・必要な罫線で区切る。入力は16px以上を保ち、キーボード/focus、show/hide、スクロールを確認する。ズーム禁止やglobal overflow clippingで崩れを隠さない。長い選択肢は折返しまたは短い選択名+説明とし、OS native popupとDOM overflowを混同しない。

## 5. 固定版をSiteへ統合

正本のreview・2clean build後、導入まで依頼されていれば既存 `browser-tools:install` のplan/apply/checkを使う。新規placementには一度発行・確認したContentId、slug/title/description、既存taxonomy、draft:trueを指定する。個別wrapper/registry/vendor/lockを手書きしない。

管理済み更新はplacementを付けず現在artifact hashをreplace-artifactで固定し、公開済み版には新exact pinのadmissionを渡す。説明本文は保持する。全toolで同じ入口を使い、名称による特別installerを作らない。

applyはローカル下書き登録とpackage/lockまで。続けて共通 `npm ci --ignore-scripts`（cacheがそろえば `--offline`）で依存実体を反映し検証/buildする。生成成功や合成fixtureをsource review・実dist受入・公開許可の代替にしない。

必要な新タグは同義語/active Registryを確認して明示的差分へ含め、共通のタグ一覧・ツール一覧・詳細へのリンクを実確認する。SEOは `site-seo-review` で同じ候補の実HTMLに照合する。

## 6. Site上の実表示・動作とpreview

PC/320/390px、文字200%、開閉、focus/blur、必要なテーマ・状態を同じ条件で撮影して実際に確認する。documentとtool双方の幅を測り、ラベル、長い入力・結果、エラー、必要な取消/再実行、解除・通信を実操作で検査する。emulationと実機は区別する。

図・式・表・補足、一覧とタグ、SEO、ライセンス/対応ソースの実リンクも確認する。代表的な質問への回答・対象外の条件・ツール起動へのリンクが公開候補のHTMLと実操作に存在することを確認し、公開後のAI回答の言及・URL引用・回答内容の検証とは区別する。認可済みレビューSiteへ検証済み候補を反映し、版・実URL・本人限定accessを確認する。本番公開へ自動昇格しない。

## 7. 正式出力と配備準備

固定source/artifact/review、必要な公開admission、Site差分と対象headのCI、配信artifact適格性を照合する。媒体/配布物があれば正規保存経路で実bytesと権利・復旧来歴を確認する。生成・検査だけの依頼でrelease/npm/deployへ進まない。

source、固定commit/artifact、実行したcommandと結果、preview、未確認の実機/失敗/残る本人判断を報告する。レビュー準備済み・配備準備済み・配信済みは[一貫制作手順](../../../docs/operations/content-production.md)で区別する。

環境・実装の失敗は原因を解消し、成功済み工程を保持して未完了箇所から再開する。無関係な全体監査を追加せず、結果不明の外部操作をblind retryしない。承認/権利/資格情報を自己発行しない。
