---
status: proposed
owner: content
last_verified: 2026-11-15
---

# 記事・ツールを依頼から配備準備まで仕上げる

通常制作の入口は記事の `japanese-technical-blog` とツールの `create-browser-tool` の2つ。担当は依頼の整理から最終確認まで進行を持つ。専門Skill、既存CLI、共通描画を必要な工程だけ呼び、利用者にSkillや内部帳票を選ばせない。これは既存Article Jobの代替実装・新しい状態機械・公開許可ではない。

ページの型は[共通構成](../content/page-composition.md)、実コマンドと編集先は[編集入口](content-workflows.md)、本文の判断は[編集方針](../content/editorial-policy.md)を正本にする。詳細契約は実行する工程の分だけ読む。過去のPR番号や古いDraft表記を現在の機能判定に使わず、対象revisionのschema・active Registry・CLIとライフサイクルを照合する。

## 最初に決めること

人間から題材、書きたいこと、使える資料、目的を受け取り、既知の会話・資料から不足を補う。[記事brief](../../templates/content/article-brief.md)または[ツールbrief](../../templates/content/tool-brief.md)の必要分を既存の非公開作業メモへ記す。毎回の記入票や追加承認にしない。

読者、読む場面、共有していない前提、今回のコンテキスト、読後に理解・判断・実行できること、対象外を短く定める。明示されていない著者の経験・意見・計測結果を作らない。妥当な仮定で進められる点は内部で記録し、根本的に違う目的や不可逆な権限判断だけを本人へ返す。

対象の基準commit、既存ID/URL/公開状態、他の変更、現在のJob/attempt、依頼の終了範囲を確認する。新規・改稿・metadataのみ・媒体のみを区別し、更新種別は[更新契約](../contracts/article-update-contract.md)から選ぶ。すべてをcorrectionにしない。

## 執筆由来ごとの入口

人間が題材を伝えたことと、人間が原稿を書いたことは別。人間の完成稿をそのまま扱う場合だけ `article init --authoring human` を使う。AIが執筆・実質改稿した原稿をこの入口へ流し、producerをhumanとして記録しない。

正式AI生成stageが対象環境で利用可能なら、固定request/responseの正規経路を使う。会話等で作成したAI稿は、まず `.local/existing-article-sources/<task>/` の非公開制作領域で本文・hero・根拠と観測できた作成来歴をそろえ、既存の `existing_ai` 受領経路へ渡す。新しい原稿も「正式stage外で受領したAI bytes」であり、架空の生成実行receiptを要求・作成しない。正式Jobがない間のbriefは同じ制作領域のメモへ置く。

新規IDは小文字のUUIDv4を一度だけ発行し、本文とintakeで一致させる。既存記事の更新なら元ContentId/URL/pubDateを維持する。`existingArticleInputSchema` に従うmanifestへ、実在する本文・hero・lineage等のpath/hash/size/originを固定する。AIの原稿は `origin: ai_generated`、来歴は実際に確認できた範囲だけで、本人承認・モデル実行・保存を捏造しない。

```sh
npm run site -- article existing-input stage --from .local/existing-article-sources/<task>/intake.json --source-root .local/existing-article-sources/<task>
npm run site -- article existing-input init --content-id <UUID> --input-sha256 <stageが返したhash> --reader-outcome "読後の目的" --local-media-processing --prepare-existing-login-audit
npm run site -- article guide --job <job-id>
```

`stage` は既存のimmutable intake実装を呼ぶローカル受領だけ。通常記事、Job state、rights、承認、公開は変更しない。更新時の `existing-input init` には適切な `--update-kind <kind>` を加える。既存AI Jobの `working.md` をhuman draft import/reviseへ戻さず、変更した本文・素材は新intakeへ固定する。

`--prepare-existing-login-audit` は承認前の準備modeであり、監査実行許可ではない。[既成AI稿の独立監査](existing-ai-article-audit.md)に従い、既に認可されたexact入力集合を再利用できるか確認し、新しい送信に必要な本人判断だけを分離する。利用可能でないAI経路をhumanへ偽装して迂回しない。本人確認済み稿の専用producerも[正規手順](owner-reviewed-existing-ai-publication.md)の実本人意思とexact bytesを必要とする。

## 先に実行環境を確かめる

作り始める前に、固定Node/npmとlock、使うCAD/回路/描画ソフト、利用可能なbrowser、素材の権利、正規保存・レビュー配布先を確かめる。既存環境を優先する。必要なツールがなければ利用可能な認可済み実行環境・互換の制作手段を調べ、未導入をそのまま利用者の宿題にしない。ライセンス購入・管理者権限・資格情報変更は推定しない。

レビューSiteが既に認可されている場合は対象ID/URL、本人限定access、更新方法を作業メモへ固定する。出力を自作HTMLへ置き換えて同じサイトと呼ばない。配布ツールがない場合も原稿・素材・ビルド・検査・差分作成を継続し、最後に未実施の配布操作を具体的に区別する。

## 制作の8工程

| 工程 | 記事 | ツール | 完了を確かめるもの |
|---|---|---|---|
| 1 目的・範囲 | 読者の問いと読後の判断、根拠の範囲を定める | 入力、出力、利用場面、精度・上限を定める | 依頼とbriefの対応 |
| 2 構成設計 | 仮タイトル、lead、節の問い、分類、根拠・素材の対応を設計する | core/UI/adapter、必要状態、説明ページを設計する | 必要要素と制作方法が決まる |
| 3 調査・制作 | 一次資料と実計測、CAD/回路/図/グラフ/配布物を用意する | 独立sourceの計算・UI・testと固定artifactを作る | 実物と再生成可能な元データ |
| 4 内容の完成 | 実結果から自然な日本語にし、図・表・式・結論を結ぶ | 正常・境界・エラー・必要な取消、使い方と実例を整える | 仮画像・予定文・架空結果がない |
| 5 Site統合 | 共通Blog構造、taxonomy、semantic media、SEOへ接続する | 正式installerで下書き登録し、共通Tool構造へ接続する | 詳細と一覧・分類・タグ・検索導線 |
| 6 Review | 必須の独立内容/画像監査と完成ページQA、認可済みpreview更新 | source/artifact reviewとSite上の操作・完成ページQA | 同じ候補のPC/スマホ実表示・検証記録 |
| 7 保存・正式出力 | 認可済みcandidateを正規media保存・保護・exportへ渡す | 固定release/admissionと配置、必要媒体を正式採用経路へ渡す | 実保存receipt、固定bytes、正規差分 |
| 8 配備準備 | 最終差分・必要CI・配信用artifact・参照先を照合する | 同じ条件に加えruntime/解除/通信境界を確認する | 未完了作業と本人判断が分離される |

表は担当の制作順。Article Job内部は既存のsource pin、例検証→独立content audit→必要なrevision→visual plan/ingest→独立visual audit→variants→candidateの順序を維持する。本文と図を先に一緒に設計しても、未実施のstageをPASSへ進めない。

## 文章と実素材

本文は読者の問いから構成する。リードとdescription、結論と末尾asideは別の役割。用語を消して意味を変えず、初出の必要位置で短く説明する。条件、主体、因果、否定、断定の強さを推敲前後で照合する。図内の時刻・速度・ラベルを周囲へ繰り返さない。

[初稿制作workflow](../../.agents/skills/japanese-technical-blog/references/first-draft-integrated-workflow.md)と[初稿品質ゲート](../../.agents/skills/japanese-technical-blog/references/first-draft-quality-gate.md)は編集判断用。F01〜F12を新しい必須帳票や公開本文へ変換しない。

数式・構成図・グラフは[技術ビジュアル](technical-visuals.md)、回路・CAD・実現象GIFは[工学素材の制作](engineering-visuals.md)を使う。libraryは共通描画経路が選び、記事内へCDN・任意script・CSSを追加しない。新しい共通表現が必要なら、既存部品との差を確認して共通部品・契約・試験を一緒に追加する。

配布ファイルは画像と同じ再エンコードをしない。編集元と配布物を分け、形式・サイズ・hash・権利・内容・再読込/展開・公開不要情報の除外を確認する。ZIP/CAD/CSV/バイナリを画像拡張子へ偽装しない。未対応形式は実装・契約の不足として解消し、登録済みと自己申告しない。

## 分類とSEOを同じ変更で完了する

`article taxonomy list --collection blog`等でactive ID・kind・aliasesを確認する。主分類、technology、purposeを本文に対応させる。必要な新語は同義語調査→Registry差分→通常reviewの順で追加し、未知語を一般語で代用したりタグページを個別実装したりしない。新タグが必要というだけで制作全体を止めない。

Registryのarchive/indexableを確認し、実候補で詳細→タグ/分類一覧→詳細をたどる。割当済みタグのリンクと全タグ索引は共通実装を使う。draftを本番一覧へ出して確認せず、私有候補で表示・公開候補検査で最終discoveryを分担する。

検索意図と自然な呼び方に加え、[AI回答での発見性](answer-discoverability.md)に沿って読者がAIへ尋ねそうな代表的な問いを構成段階で考える。本文に答え・条件・根拠が存在するかを候補と実HTMLで確認し、記事では独自の根拠、ツールでは入力・結果・制約と操作導線を優先する。不要なFAQや質問数ノルマは設けない。

完成後に[site-seo-review](../../.agents/skills/site-seo-review/SKILL.md)で実HTMLを照合する。title/description/canonical、OG/Twitter、JSON-LD、hero、日付、内部リンク、公開対象のsitemap/feed/searchを確認する。検索順位やAI回答での引用は保証しない。公開後のAI回答における言及・URL引用・回答の正確さは、実測条件とともに別指標として記録する。

## 完成ページQAと本人限定preview

図単体の監査と完成ページの確認を分ける。同じcandidateの本文、図中文字、数式、表、グラフ、download、操作を320/390/1440pxと文字拡大で見る。数式・図の局所scrollはよいが、ページ全体の横はみ出しや、巨大な図の一律縮小で文字を潰す方法は不可。

キーボードfocus、必要な代替説明、動く図の停止/reduced-motion、リンク・画像・ファイルの実取得、見出しの階層、重複した題や注意を確認する。グラフの値はtooltipだけへ隠さず、表・本文・データへの経路を持つ。数式画像でコピー可能な式を置換しない。

素材存在・DOM overflowゼロ・スクリーンショット保存だけを意匠/可読性PASSにしない。画像を実際に確認する。独立監査へ完成ページを渡していなければ未検査とし、後段のQAで補う。Chrome emulationは実機mobile・screen reader試験ではない。

認可済みのレビューSiteは作業完了ごとに同じ対象へ反映し、保存された版、実URL、認証/noindex、本文・素材・リンクを確認する。ローカルbuild、共有preview、本番配信を別に記録する。本人限定ページから公開R2へ未承認素材を先出ししない。

## 正規保存と配備準備

[media公開CI](article-media-publication-ci.md)、[build artifact](build-artifact-pipeline.md)、[配信境界](deployment-boundary.md)の現行経路を再利用する。通常CLIにないupload方法を記事ごとに作らず、main/Environment/本人確認の条件は維持する。媒体だけの登録が採用・認可済みの場合も、媒体公開と記事公開を区別する。

保存を実行したらA/B/Cの対象集合と実bytes照合、Registryの参照、同じcandidateとの一致を確認する。公開日は正規export/実配信のJSTを使用し、初回updatedDateを作らない。更新は元pubDateを保持する。日付だけの変更で無関係な全面AI監査を再実行しない。

最終headの必要CI、正式export差分、配信用artifactの適格性、媒体・添付ファイルの参照先を確認する。PR candidate artifactはProduction artifactではない。merge/本番配信が未認可なら実行せず、そこまでに可能な準備を完了する。

## 失敗時に全工程へ戻さない

`development-workflow.md`に従い、原因を実装、環境/依存、権限、通信、証拠不足へ分ける。成功済み工程を保持し、原因を修正して最初の未完了工程と影響範囲だけを再検証する。根拠・媒体・本文の変更は関係する候補/承認を失効させるが、無関係な変更を口実に全工程を繰り返さない。

本人しか決められない事項以外は、利用可能なtool・source・既存経路を調べて解決する。権限不足でも独立して進められる制作・検査・差分作成は進める。未知の外部書込み結果はreadonly照合を先に行い、blind retry・同じkeyの上書きで修復しない。

## 完了の呼び分け

- **レビュー準備済み**: 内容・必要素材・分類・SEOがそろい、実表示を確認した本人限定previewがある。配布操作未実施ならその状態を明記し、共有済みと呼ばない。
- **配備準備済み**: 必要な承認・実保存/保護・正式出力・最終CI・配信に使えるartifact/参照先の確認が終わっている。内容や登録作業を残さない。
- **配信済み**: 認可された配信を実行し、配信後の本文・素材・リンクを確認している。

状態は既存Job/PRから説明する呼称で、新しい状態機械ではない。完了報告は対象ID/URL、head、実施した検証、preview、媒体/添付、残る本人判断を必要な分だけ示す。未実行をPASSにせず、スキル改修を記事品質やFB削減の実証としない。

## この手順の受入れ

新規記事（新タグ・実図・動く図・配布物・任意aside）、文章中心の記事、新規tool、既存記事の限定修正で、必要要素・公開隔離・共通部品・復旧点を確かめる。契約test、実library描画、完成ページQA、実R2保存、本人の編集評価は別の証拠とする。合成fixtureを公開記事にせず、実providerを使わない試験を実保存と呼ばない。
