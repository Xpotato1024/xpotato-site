# MuJoCo 4.0記事の公開準備

**承認済み原稿を正式な existing_ai Job と content 監査対象一覧へ結んだ準備PRです。独立監査・正式export・本番配信は未実施です。**

[approved-candidate.mdx](approved-candidate.mdx) にレビュー済みの原稿を保全しています。本文の採用と、公開処理が要求する固定入力の監査・本人承認・保存記録は区別します。

| 項目 | 固定値 |
|---|---|
| 記事 ContentId | `09e6785f-6da5-4c2f-892b-e573845f0e9c` |
| 公開予定route | `/articles/09wsw5yvd59gqrjaz5ee25y3mw/` |
| 正式exportの予定先 | `apps/site/src/content/blog/09wsw5yvd59gqrjaz5ee25y3mw.mdx` |
| 承認済み原稿 SHA-256 | `c1b5a7e03c8b103c177efe5fb347dc9cf8a848d307e79c88fbd555a802393534` |
| 本文 SHA-256 | `b2621b86b240cc20ed5d614cf170683ad1de615b1ec8fef7bb16918fcd46c2ab` |
| 作業開始時の main | `7254627c86a99b0f2a0da66334aebb95b6b7d9b0` |

このdirectoryは通常のcontent入力範囲外です。原稿をcanonicalへ手コピーしたり、`draft: false`だけで公開したりしません。画像binary、private source本文、preview専用URLもGitへ追加しません。

## 回収・検証した素材

[canonical-master-verification.json](canonical-master-verification.json) に、元のingest成果物から回収した静止WebP 7件と、比較GIF 3件の実SHA-256・bytes・寸法・全画素decodeの結果を記録しました。[media-evidence.json](media-evidence.json) の原本実体の確認状態も更新しています。R2保存や権利承認の証明ではありません。

主となるGIF 3件を、時間・ループ・実画素の再生内容を保つ animated WebP に正規 ingest しました。静止poster 3件は独立したassetとして保持し、本文のFigureは6件のままです。hero・静止図・social を含む canonical は11件です。これらはprivate reference用の実bytesであり、独立監査や公開保存が済んだという記録ではありません。

heroはUnitree Go2のモデル描画、DeepMindロゴは公式の記号・文字ロゴを使っています。Go2のBSD-3-Clause原文、公式ロゴ取得元、編集利用条件と帰属表示の候補をprivate入力へ保存しています。previewのrightsラベルを新しい正式承認へ昇格させていません。

## 根拠と公開用入力

27件の出典・実データ記録、31件の本文claim、2件の説明用コード例を結び、正規source/evidence schemaとローカル分析を通過しました。本文の引用表示は変えていません。RTFは固定された18回×3条件から再計算し、本文の丸めと比率の一致を確認しました。新たな測定値を作ったものではありません。

大きな塑性試行logは原本hashを保全し、元行の位置・hashに追跡できる限定抽出をintake用に作りました。説明用XMLと更新コマンドは、実行結果を保証するコード例として扱っていません。

初回公開日の候補は、正規 `prepareExistingPublicationMetadata` による2026-11-13（JST）です。[publication-candidate.mdx](publication-candidate.mdx) と [publication-date-lineage.json](publication-date-lineage.json) を固定入力へ採用しました。元原稿の2026-11-11は保全し、本文・引用・日付以外の編集項目は一致しています。予定日であって、公開済みという記録ではありません。

## 正式入力の到達点

[formal-input-preparation.json](formal-input-preparation.json) に、実 Job・intake・native render・canonical media・content監査対象のhashを記録しました。固定revisionは `a2fa4cf108bbd2b7301088cb6651953faf32c2a3`、Jobは `job-5821b872-125b-48aa-bfd3-570f99d9e589` です。

immutable intakeは97 artifacts、出典27件・claim31件・説明用コード例2件です。正規CLIでsources/evidence import、examples inspect、content audit prepareを実行しました。[content-audit-disclosure-inventory.json](content-audit-disclosure-inventory.json) は33件・2589680 bytesの実対象一覧です。開示grantのadmitや外部監査runは行っておらず、この一覧自体は承認ではありません。

## 正式化の手順

手順の正本は [content-workflows](../../../operations/content-workflows.md)、[既成AI稿の独立監査](../../../operations/existing-ai-article-audit.md)、[手動media publication CI](../../../operations/article-media-publication-ci.md) です。

1. **実施済み:** 共通animation実装を含む固定revisionで、実表示・原本・出典をimmutable intakeへ結び、AI稿の来歴を維持した `existing_ai` Jobを作成。
2. **対象一覧まで実施済み:** 既存OpenAI ChatGPT/Codexへのexact入力の開示を確認した後、正規の独立content/visual監査を実行する。過去のpreview QAや手書きのPASSは代用しない。
3. 機能PR [#185](https://github.com/Xpotato1024/xpotato-site/pull/185)・[#186](https://github.com/Xpotato1024/xpotato-site/pull/186) のmain反映後、同じ作業rootを検証済みのmain SHAへ切り替える。Job・intake・監査記録のbaseは書き換えない。正式candidateと表示を一致させ、本人の候補承認を記録し、正規 `media-publication.ts prepare` でpackageとadmissionを生成する。両記事のpackageは、いずれかの記事のcanonical更新をmainへ入れる前にprepareする。
4. admissionを通常PRでmainへ採用し、本人のDraft Release assetと保護された手動CIを通じて原本・公開・保護の保存とread-backを行う。
5. 実保存artifactの `changes.patch` と `files/` から、MDX・media・rights・provenanceを同じ候補の通常記事PRへ反映する。その差分でこのstagingを撤去する。
6. 当該headのCI、配信先と画面を確認して本番反映へ進む。保存・merge・deployの状態をそれぞれ実結果で確認する。

この準備PRのmergeだけで記事が本番に出るわけではありません。元のprivate Jobは保全し、権限や過去のdeny記録を書き換えていません。

## 検証の位置付け

現在の準備はNode 24.22.1と指定npm 11.19.0を使用します。最終animation版をnative Astroで構築し、320/390/1440pxで全ページ＋全Figure詳細の21枚を実取得しました。読込み・横overflow・停止/再生・reduced-motion・画像と操作ボタンの非交差を確認し、390pxでは実描画のフレーム変化も記録しました。本文CSSと図題の実測値を、画像内の文字サイズと取り違えていません。これは独立監査や実機モバイル確認の代用ではありません。

初回staging時のNode 24.14.0によるfrontmatter・taxonomy・portable MDX検証は過去の限定検証です。正式なcontent/visual監査、候補承認、保存、canonical exportの成功を示すものではありません。
