# MuJoCo 4.0記事の公開準備

**完成本文のレビュー用 Draft。正式なmedia保存・exportは未実施で、公開不可。**

[approved-candidate.mdx](approved-candidate.mdx) は、本人が確認済みとして指定した本文を変更せず収録したものです。本文の採用指定と、正式Jobの承認・権利・保存許可を区別します。この資料は新しい承認記録、content/visual audit、publication admission、保存receipt、公開provenanceではありません。

| 項目 | 固定値 |
|---|---|
| 作業base | `7254627c86a99b0f2a0da66334aebb95b6b7d9b0` |
| ContentId | `09e6785f-6da5-4c2f-892b-e573845f0e9c` |
| 公開予定route | `/articles/09wsw5yvd59gqrjaz5ee25y3mw/` |
| 正式exportの予定先 | `apps/site/src/content/blog/09wsw5yvd59gqrjaz5ee25y3mw.mdx` |
| 分類 / タグ | `robotics` / `python`, `release` |
| 本文SHA-256 | `c1b5a7e03c8b103c177efe5fb347dc9cf8a848d307e79c88fbd555a802393534` |
| 既存private Job | `job-c561397b-f194-4e8e-88d1-01fce3b6c17c` |

本文は `draft: true` のままです。リード、比較目的→RTF説明→表の順序、実描画のFigure、引用、ArticleEndnoteを保持しています。`pubDate: 2026-11-11` は元previewの値で、実公開日の確定ではありません。正式exportでは現行のJST日付規約に従います。

## 配信からの隔離

このdirectoryは通常contentの入力範囲外です。`apps/site/src/content/`、media/rights/provenance registry、publication admission、public assetには何も追加していません。したがって通常buildでこの記事のrouteや画像参照は生成されません。本文をcanonicalへ手コピーしたり、`draft: false` に変えるだけで公開したりしないでください。

画像binaryとpreview専用URLは収録しません。Figureのasset名は、正式なmedia registryへの登録を待つ論理参照です。[media-evidence.json](media-evidence.json) は実ファイルと照合したローカル画像/GIFの対応表であり、配信用registryではありません。元previewにある `active` やcontent-addressed object keyは保存の証明にならないため採用していません。候補canonical sourceのmetadataもR2 receiptとは区別しています。

## 確認できた素材と未完了の条件

- heroと本文Figure 6点に対応するWebP 7件、および比較GIF 3件をローカル実ファイルのSHA-256・bytesと照合しました。GIFは証拠入力として保持し、Gitやpublicへコピーしていません。
- heroはUnitree Go2モデルの描画、ロゴはGoogle DeepMindの商標を含みます。previewのrightsラベルは採用済みの権利記録ではありません。実際のlicense・notice・帰属表示・公開範囲を正式に確認する必要があります。
- 既存Jobの `repositoryExport`、`privateCanonicalMediaStorage`、`publicMediaUpload`、`protectedMediaOperation` はすべて `false`。このPRでは変更していません。
- 本文のSHAは既存Jobの最終working原稿とは異なります。本人指定の完成本文を正式attemptへ取り込み、その本文・根拠・画像と監査・candidateを一致させる必要があります。既存の監査メモを現在の正式PASSと読み替えません。
- 現行publication packageは静止画のmetadata/全bytesを検査します。比較GIFの存在だけでは正式配信できません。承認された動き・比較の意味を維持できる既存media経路を確認し、不可なら公開を止めて対象範囲の判断を戻します。無断で静止画へ置換せず、このPRにschema/runtime拡張は含めません。

## 正式公開へ進む手順

正本は [content-workflows](../../../operations/content-workflows.md) と [article-media-publication-ci](../../../operations/article-media-publication-ci.md) です。この節自体は操作許可を与えません。

1. 元private Jobと素材を保持したまま、現行の `article draft import` / `article revise` で完成本文を正式attemptへ取り込む。ContentIdを維持し、出典・実測RTF・再現記録のmaterial claim binding、technical-example assessment、変更範囲に対応するcontent/visual audit、権利・開示・canonical master・delivery setを検証する。今回のhash照合やPRレビューを本文監査の代用にしない。
2. 正式candidate・previewの一致を確認し、必要な本人承認・保存/export許可を正規経路で得る。現在のfalseをAIが書き換えたり、承認・receiptを生成したふりをしたりしない。
3. 正式Jobに対し `node --import tsx tools/publication/media-publication.ts prepare --job <job-id> --output <private-output>` を実行する。出力はCLIの制限どおりrepositoryのprivate `.local` 配下とし、実作業時の登録済み一時rootへの隔離条件も満たす。生成されたpackage/admissionを検証する。現在は必要条件未達のためprepare未実行、admissionなし。
4. 生成されたadmissionだけを `config/article-publication-admissions/<ContentId>.json` として通常PRで審査する。本人アカウントのdraft releaseへ固定packageを置く。main採用・release操作・手動保存CIの起動は今回の権限に含まれない。
5. 別途本人の認可を得たmainの手動CIで、原本A→公開B→保護Cの実保存・readback・exact object setを検証する。未知のPUTや欠落では停止する。
6. 実保存artifactの `changes.patch` / `files/` とreceiptを照合し、正式exportのMDX・media/rights/provenance registry・cleanup-safe material claims・mediaRecoveryを同じ候補に結合する。通常PRと現在headの必須CIを通す。このステージングはその差分で撤去し、二つの本文正本を残さない。
7. Ready・merge・配信は別途の本人判断で行う。private Jobや素材のcleanupは耐久Git/claim/recovery/保存chainの検証と本人確認より前に行わない。

このDraft PRは完成本文と素材同一性のレビューを可能にしますが、正式保存・公開の完了やmerge-readyを示しません。

## この差分の検証範囲

現在worktreeの `blogFrontmatterSchema`、`validatePortableMdx`、taxonomy registry、ContentIdからのroute導出で本文を検証し、すべて通過しました。FigureとArticleEndnoteは既存の許可moduleです。元本文とのbytes一致、素材manifest全13fileのhash/size一致、7asset・比較GIF 3件の対応、日本語UTF-8も確認しています。

依存関係は既存worktreeのinstallを読み取り専用で利用し、現行validatorのTypeScriptをメモリ内で変換しました。実行Nodeは `24.14.0` で、repository指定 `24.22.1` と異なります。これは限定的なsource検証であり、標準toolchain・通常build・`ci:final`・ブラウザー受入れ・正式content/visual audit・R2確認の成功を示しません。記事内のinstallコマンドは実行していません。
