---
status: proposed
owner: operations
last_verified: 2026-11-21
---

# 下書き編集と全体CIの分離

記事更新・添削で待つ**実経過時間**を短縮する。runnerの延べ時間は主指標にしない。判断理由は[ADR-0091](../design/adr/0091-draft-editing-ci.md)、現在のjob graphは[build artifact pipeline](build-artifact-pipeline.md)、測定は[CI性能](ci-performance.md)を参照する。以下はPR #234の実装候補であり、mainへの採用・本番配信の記録ではない。

## 計画と今回の範囲

| 経路 | 対象 | 今回の扱い |
| --- | --- | --- |
| 即時プレビュー | 編集中の本文 | CMSの既存AST描画。GitHubの完了待ちはない |
| 正式Astroレビュー | 選択commitの原稿と正規layout | 既存の独立workflowを継続。全体CIを待たない |
| 下書き用CI | 旧新とも未公開の原稿、または新規下書きと正規の索引 | 今回分離。内容を検証してから短い経路へ進む |
| 全体CI | 公開済み記事、公開状態変更、媒体・来歴・分類・連載・コード変更、判定不能 | 既存の全gateとrelease/Windows検証を維持 |
| main CI | mainの原稿・コード等の変更 | 下書き変更を含め全体CI。既存prose-only例外は維持 |

最初に日常のCMS保存を分離する。CMSは `draft:true` の原稿と `content/registry/editor-content-index.json` を同時に保存するため、原稿pathだけの許可では題名変更や新規作成を短縮できない。索引は対象原稿の派生行だけを許可する。

公開済みの記事を下書きへ戻す変更は公開URLを取り下げるため、下書き用CIには入れない。通常の公開exportもmedia/rights/provenanceや生成indexの変更を伴うため全体CIへ送る。公開記事用CIをさらに分離する次段階では、旧新JSONをContentIdへ結び、実行可能なindexの正規projectionを検証し、内容に依存する現buildのbrowser/WebKit検査を残す。今回の実装にその省略は含めない。

## 二段階の判定

1. `scope` の `article-pr-policy.mjs` はNode標準APIだけで候補を選ぶ。同一repositoryのPR、exact head/base、baseがheadのancestor、A/Mだけの通常fileを要求する。原稿、対応するCMS索引、既存のprose例外以外は全体CI。ここでは未公開であることを証明したとは扱わない。
2. 候補だけ `article-fast` で一度依存を導入し、`article-pr-admission.ts` が既存のCMS parser/schema/portable MDX validatorを使う。追加原稿は `draft:true`、変更原稿は旧新とも `draft:true`、同じpathのContentId不変を要求する。旧新の索引を正規parserで読み、原稿のmetadataと一致する行だけが変わり、その他の行は変わらないことを確認する。
3. `eligible=true` の場合だけ同jobで下書き用検査を行う。公開内容・共有入力・不明・不正な原稿は `eligible=false` として全体jobへ戻す。インストールやjobの異常終了、下書き用検査の失敗をfallback成功に読み替えない。

全体jobは、候補jobが対象外でも開始する条件と、意味判定が正常に全体CIを選んだ条件を明示する。候補jobのfailure/cancelledを無視しない。stable `result` は分岐に応じた必須job集合と成功を確認し、出力欠落・別分岐の実行・部分成功を拒否する。

PRへ `ci:full` labelを付けると全体CIを強制できる。labelの追加・削除も再判定のtriggerとする。軽量化の解除にコード編集は不要。mainでは下書きを含む原稿・コード変更ごとに全体CIを実行するため、過去の成功や週次実行で公開前の検査を代用しない。

## 下書き用CIで維持する検査

`npm run ci:article:fast` は次を同じcheckoutで実行する。

- 固定Node/npm、配布済みTool bytes、生成済みeditor manifest/index。
- 全repositoryのschema・ContentId・taxonomy・portable MDX・参照・provenance・公開hold整合性。
- Astroの型・原稿検査、site/editorの正規build各1回、同sourceからのsearch/publication/CSP生成。
- publication照合、全体static output、HTML/CSS/JS/font/mediaのperformance budget。
- 公開route・redirect・全内部link・search・RSS/sitemap・metadata・配信headerの検査。

原稿は正規portable MDXだけを認める。runtime import/export、任意JSX、生HTML、式・spread等は既存AST validatorで拒否する。fenced codeの説明例をruntime importと誤認する独自正規表現は作らない。

Markdownの画像記法と参照形式の画像は、Astroが後段でimportへ変換する場合があるため旧新とも全体CIへ戻す。CMSの登録媒体を使うFigure/Galleryはこの記法と区別する。コードブロック内の画像記法は実画像ではないため短経路の対象を維持する。

公開catalogはdraftを除外し、各route、検索、feed、関連記事、連載はその公開集合から生成する。Tailwindはcontent sourceをscanせず、font subsetは生成済み公開HTMLから作る。CMS索引は認証API用で、公開editor bundleとは分離される。これらの実装やlockの変更は候補pathから除外するため、公開UIに渡る内容を変えない下書きだけを短縮する。

Astroは下書きもcompileするため、build自体や出力予算を省かない。commit SHA/日時を含むfooterは正常に変わるので、base/headのdistが完全に同一bytesだとは主張しない。別revisionのHTML・成功report・release artifactを流用しない。

この経路では全unit、publication lifecycle、固定Common Tool/CMS/browserの機能matrix、公開browser/WebKit、release packaging、Windows consumerを実行しない。公開内容を変えるPRとmainでは従来どおり実行する。下書きCI成功は記事公開承認・release資格・配備認可ではなく、release artifactも作らない。

## 実経路の回帰と測定

全体CIには独立した `article-regression` を並列に追加する。所有が確認できる一時worktreeに有効なCMS下書きと正規索引を作り、題名・本文を更新したcommitに対して同じ意味判定・同じ下書き用commandを実行する。実公開原稿は変更しない。公開HTML・検索・feed等へfixture原稿が漏れていないことと、元のworktree/HEADが保たれることを確認する。

このjobは全体CIの必須結果および同run/attemptのpackage gateに含める。下書き用経路をコードPRで一度も実行しないまま、全体CI成功だけで有効と判断する状態を避ける。合成原稿の時間、workflow全体の時間、実際の記事PRの時間は区別して記録する。

対象回帰は実Gitの新規・本文/題名更新・索引更新、安定ID、公開状態切替、不正AST、無関係な索引行、rename/delete、通常file/checkout identity、強制fullを含む。Linuxの実stable-result shellに失敗/取消/対象外/出力欠落を与え、誤ってmerge可能なPASSにならないことも確認する。

## Shadow観測の位置付け

既存 `ci-impact.mjs` は影響仮説の記録として残す。`site-ci-impact-<run>-<attempt>` にexact base/head、変更status/path、影響領域、未解決依存を保存するが、job outputやskip権限を持たない。Blog/Notes候補でも、ホーム・一覧・関連記事・検索・RSS・sitemap・route/link・媒体整合性を影響候補に含める。

[35件の履歴分類](../benchmarks/ci-impact-history-20261114.json)は全体34件/prose1件/記事候補0件だった。これは旧path分類の到達率であり、今回の意味判定の実測ではない。2026-11-15以降のbrowser責務分割は全assertionを保持した並列化であり、今回の下書き専用経路と区別する。公開内容の高さ・隣接要素・font・共有CSS/CSPの影響をpathだけで否定しない。
