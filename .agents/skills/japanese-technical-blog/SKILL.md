---
name: japanese-technical-blog
description: 日本語技術記事の依頼を、目的・読者の整理から調査、本文と実素材、共通構造、分類・SEO、本人限定プレビュー、正規保存と配備準備まで一貫して進める入口。新規・実質改稿・比較/試用の記事化に使う。独立監査や本人承認を代行せず、ツール実装・ADR・README・本番配信だけの作業には使わない。
---

# 記事を完成させる

原稿を書くだけでなく、依頼された終了範囲まで内容・実素材・Site統合・検査を担当する。利用者に内部Skillの選択や既知条件の再入力を求めない。単一agentによる自己監査PASSや公開権限の拡張は行わない。

## 最初に読む

- [一貫制作手順](../../../docs/operations/content-production.md): 8工程、復旧方法、完了状態の正本。
- [共通ページ構成](../../../docs/content/page-composition.md): 記事/ツールの要素と所有者。
- [編集入口](../../../docs/operations/content-workflows.md)と対象revisionの編集方針・schema・active Registry。

編集上の判断には[初稿制作workflow](references/first-draft-integrated-workflow.md)、提出時には[初稿品質ゲート](references/first-draft-quality-gate.md)の担当項目を使う。詳細資料は必要な工程だけ読む。

## 1. 依頼からゴールを定める

[内部brief](../../../templates/content/article-brief.md)の必要分を既存private Jobのメモへ整理する。題材、目的、読者、読む場面、コンテキスト、共有していない前提、読後に判断・実行できること、対象外を定める。記事modeは読者の目的で選ぶ。

タイトル・lead・分類・図を先に固定してから目的を後付けしない。過去に確定した良い点と最新の明示指示を保持し、撤回された案を復活させない。調査で解決する不足は調べ、著者の経験・意見を創作しない。

現行head、ContentId/URL、執筆由来、Job/非公開制作領域、既存素材、他の作業、終了範囲、認可済みレビューSiteを確認する。人間の完成稿だけ `article init --authoring human`。AIが作成・実質改稿した本文は正式AI stage、または実bytes/来歴を固定する `article existing-input stage` → `existing-input init` へ接続する。[由来別の具体手順](../../../docs/operations/content-production.md#執筆由来ごとの入口)に従い、AI稿をhumanへ変換しない。更新は同じContentIdと適切なupdateKindを使い、canonical MDXへ直接書かない。

## 2. 構成と制作方法を決める

各節で答える問い、必要な根拠、対応する図・式・表・実例を設計する。[AI回答での発見性](../../../docs/operations/answer-discoverability.md)に沿い、読者がAIへ尋ねそうな代表的な質問と本文での回答位置・根拠を対応させる。仮タイトル、lead、主分類、technology/purposeタグ、description、heroを決める。質問数ノルマや定型FAQを設けない。語数・図数・章数を固定せず、読者が脳内で補う空間・時間・因果・比較を見つける。

更新紹介は対象の識別→更新の出来事→読む理由をleadに置く。導入は用途・背景へ進み、全体像を示してから代表例を深掘りする。制作済みGIFだけで更新全体を代用しない。[更新紹介](references/reader-first-visual-updates.md)を参照する。

制作環境と保存・preview経路を先に確認する。数式・構成図・グラフは[技術ビジュアル](../../../docs/operations/technical-visuals.md)、回路・CAD・simulationは[工学素材](../../../docs/operations/engineering-visuals.md)から題材に適した手段を選ぶ。

## 3. 根拠と実素材を用意する

主張をfact / inference / experience / recommendation / unknownに分け、公式仕様・一次資料・実ログ/実測へ結ぶ。版・日付・API等は現在の根拠を調べる。検索候補と固定sourceを混同せず、観測していない実行結果や数字を作らない。

比較では変更する条件と固定する条件、成功条件、指標・分子/分母・単位・計測範囲を先に決める。バージョン比較では版自体が変更条件になる。速いが失敗する基準も残し、成功する対策として推薦しない。

実CAD/回路/保存state/データから図・GIFを制作し、編集元と掲載用出力を残す。実画面や実破損を生成画像で代替しない。heroは識別と導入、説明図は理解、観測は証拠として分ける。承認済みoriginal heroを勝手に置換しない。

semantic stageは固定requestとresponse schemaの範囲でproposalを作り、後続の認可された実制作へ渡す。制作を依頼されているのに「ここに図を挿入」で終えない。

## 4. 本文・メタデータを仕上げる

[自然な日本語](references/natural-japanese.md)と[具体例・図](references/concrete-visual-editorial.md)で、意味・主体・条件・否定・断定の強さを保つ。読者の疑問に答え、用語を必要な位置で短く説明する。補助指標は比較の目的・条件を示した後、表を読む直前等に一言定義する。

リードとdescriptionを同じ義務文にせず、本文の章立てをrepoの構成順にしない。図題・補足・本文へ同じ説明を積まない。図中の倍率・時刻の反復は削除し、必要なalt・権利表示は保つ。

結論は問いへの答え、使いどころ、次の判断で閉じる。短い来歴・方法・限界が必要な場合だけ、対象revisionでactiveな共通ArticleEndnoteへ分ける。重要条件・安全は本文へ残し、endnoteや定型まとめを全記事に強制しない。

## 5. 共通構造へ組み込む

BlogDetail/ContentLayout、本文module、共通font・見出し・図・asideを再利用する。記事ID指定CSS、任意HTML/JSX/import、独自metadataを作らない。必要な共通機能がないなら所有者・入力・描画・検査を共通実装として整える。

本文とタグRegistryの意味を対応させる。新タグは同義語確認→明示的Registry差分→共通一覧生成→実リンク確認まで同じ作業で扱う。タグごとのrouteを手実装しない。

媒体は `media:` と正規Registryへ、配布ファイルは形式別の管理経路へ結ぶ。画像とバイナリを同じ画像変換へ通さない。SEOは `site-seo-review` で実HTMLのtitle/description/canonical/OG/JSON-LDと一覧・検索等を照合する。

## 6. 監査と完成ページQA、previewを行う

自己点検後に必要な独立内容/図版監査を既存順で実施し、指摘と依存箇所だけを修正する。想定質問への答え・重要条件・根拠が本文と静的HTMLに残るかも確認し、公開後のAI引用観測と混同しない。自己評価を独立監査や本人承認として記録しない。

[掲載幅](references/audience-and-visual-scale.md)で実記事を320/390/1440px、文字拡大、focus、必要な印刷で確認する。図中文字・式・表・リンク・GIF停止・downloadも実体で見る。単体図の監査を最終ページの合格にしない。

認可済みの本人限定レビューSiteは検証済みの候補を都度反映し、実URL・版・認証/noindex・内容を確認する。ローカルbuildと共有preview、本番配信は別の状態。

## 7. 正規保存・正式出力へ進める

必要な本人確認と認可が成立した同じcandidateを、既存のmedia公開CIとexportへ渡す。実保存・readback・保護・Registryと来歴を照合する。未承認画像の公開R2先出し、直接canonical編集、receiptの自己申告をしない。

公開日/更新日は正規処理で扱い、初回updatedDateを捏造しない。承認待ちでも独立して進められる準備を終え、何が本人判断かを具体的に残す。

## 8. 配備準備を確認して引き渡す

最終差分、必要CI、正式出力、配信用artifact適格性、媒体と添付の実参照を確認する。完了は原稿の存在やbuild成功だけでなく、依頼された形で読めて使えること。

レビュー準備済み・配備準備済み・配信済みを混同しない。本番merge/deployは別認可を守る。結果不明の操作をblind retryせず、成功済み工程を保持して原因と未完了箇所から復旧する。スキル改修だけでFB削減や実読者理解を達成したと報告しない。
