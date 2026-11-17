---
status: proposed
owner: operations
last_verified: 2026-11-14
---

# 変更範囲に応じたCIの準備

記事・toolの増加に合わせて全検査が無制限に増えることを避けるため、まず変更の分類を通常CIと並べて観測します。**この段階では検査を省略しません。** 既存のprose-only例外、必須result、build once、mainのProduction artifact、手動deploy境界は変更しません。

## 今回の実装範囲

`scope` jobで `ops/ci/ci-impact.mjs` を実行し、`site-ci-impact-<run>-<attempt>` artifactにJSONを30日保存します。repository/run/attempt/event、base/headのexact Git revision、分類実装のsource SHA、比較方式、変更statusとpath、候補分類、影響領域、未解決の依存を記録します。job outputを生成せず、他jobの `if` 条件には接続しません。テスト成功cache・前回artifactの流用・記事の変更はありません。

- Blog/Notesの直下にあるMarkdown/MDXの追加・変更だけなら `article-impact-candidate`。proseが混ざっても候補です。これは安全なskipの証明ではありません。
- 候補でも、変更記事に加え、ホーム更新一覧、collection一覧/pagination、category/tag一覧、search index/UI、RSS、sitemap、全記事の関連記事card、route/redirect、全content link、publication/media整合性を影響候補へ含めます。記事title/tag/date/公開状態が変わると未編集ページにも波及するためです。
- 削除・rename/copy・type変更、tool/project/page、共有component/style/build/compiler、registry/provenance/media/taxonomy、dependency/lock、CI/script、未知pathは `full`。renameの旧path/新pathを両方保存します。削除は旧URL・参照・paginationの消失を限定できるまでfullです。
- base不明、Git失敗、空diff、不正path/statusもfull。baseがheadのancestorであることを確認して、base SHAとhead SHAのtreeを直接比較します。base branchの前進等で分岐していればfullです。分岐したtreeの一致を、依存が変更されていない証拠とみなしません。
- prose-onlyの実行可否は従来の `ci-scope.mjs` が唯一の決定元です。shadowがfullでも現在のprose-only policyを書き換えません。

## まだ証明していないこと

このmanifestはpathに基づく**影響仮説**です。ContentId/旧新routeの解決、MDXのimport/export/inline JSXを含む意味解析、reverse dependency graph、共有CSS/chunkの生成結果、各browser suiteとdomainの完全な対応は未実装です。候補分類とfull suiteの成功が並んだだけでは、省略したsuiteが不要であることは証明できません。

記事の追加で全体のsearch/feed/一覧を更新する処理は残ります。現在のAstro全体buildを部分buildへ置き換えるものではなく、公開HTMLを前回buildから継ぎ足しません。別revisionのPR artifactをmainのProduction artifactに昇格させません。

## 段階的な有効化条件

1. shadow reportを実際の記事更新・追加・削除・rename、tag/公開状態変更、tool更新、共有style変更で収集します。通常full CIは継続します。
2. old/new metadataと安定ContentId、route、registryのreverse参照を解決します。記事の共通出力と全リンク検査を残し、各suiteの入力と影響domainを明記します。依存を特定できない項目や、許可済みsemantic moduleの範囲を超えるMDX import/export/inline JSXはfullです。
3. 候補で省略される予定の検査に意図的な不具合を入れ、分類の拡大または残る検査によって確実に検出する回帰試験を作ります。articleへ共有moduleを導入する場合、publication state変更、related順位変動、old URL消失、検索結果変動を含めます。
4. 最初はPRの独立した重いbrowser検査のみを限定します。schema・ContentId・参照・公開境界・静的全体整合性、公開buildは維持します。mainとrelease候補は全検査を保ち、実行時間と見逃しを比較します。
5. reviewedな変更でskipを有効化する時に、定期full実行・強制full入口・失敗時のfull fallbackを同時に用意します。現段階でscheduleやskipは有効化していません。dependencyの未知・validator/lock/policy変更・証拠失効はfullへ戻します。

## 測定方法

manifestの `estimatedSavedSeconds` は `null` です。shadow自体による短縮はなく、小さい分類・artifact保存の追加時間がかかります。ローカル分類テストの時間をHostedの短縮率に換算しません。

今後はexact source/run/attempt、cold/warm、queue、記事数/tool数、変更class、job/step/suite時間を併記します。並行suiteの時間を足した値ではなく、最長経路とjob待ち時間からwall timeを評価します。対象suiteを外しても最長経路が変わらなければwall timeの短縮見込みは0です。記事数を増やした測定は合成fixtureとして実記事・実測と区別します。

既存の時間測定と共有runnerの比較条件は[CI性能の記録](ci-performance.md)、release条件は[build artifact pipeline](build-artifact-pipeline.md)を参照します。

## 回帰検査

`node --test ops/ci/ci-impact.test.mjs` は追加/変更、prose混在、shared/registry/tool/unknown、全体依存領域、NUL区切り・Unicode/space、rename/delete/type、base欠落、分岐したbase、workflowがskipを消費しないことを検査します。`npm run test:release` とscope jobにも含めます。通常のrelease graph回帰は既存の全gateを引き続き検査します。

## 履歴による分類の確認

[直近35件のmerge PR再分類](../benchmarks/ci-impact-history-20261114.json)は、PR210までのfirst-parent merge commitを新しい順に35件選び、各mergeの第1parentをbase、第2parentをPR headとして分類した結果です。実行時間の測定ではありません。fullが34件、既存prose-onlyが1件、article候補は0件でした。PR204/198などの記事更新はmedia/rights/provenanceとindexの更新を伴い、単純なMarkdown path分類だけでは実際の更新を短縮できません。

次の有効化には、記事単位registryのJSON差分をContentIdへ結び、indexの任意コード変更を別扱いにする検証が必要です。未編集routeの省略には、成功済みbase証拠とheadの配布依存が同じことを示します。CSSのcontent scanは現在 `@source not "../content/**"` で除外されていますが、MDXのimport/JSX、生成chunk、font・mediaや共有layoutへの影響までpath一致だけで否定しません。

まず重いbrowser suiteをcontent/searchとhome/navigationへ分け、全assertionを維持したまま独立した測定・依存境界を作ります。これは選択実行の有効化ではありません。main/PRとも全suiteを実行します。


## 2026-11-15: 実行責務の分離

公開browser検査は次の7領域を並列実行します。`release-browser-reports.mjs` のsuite集合が実行と集約の共通定義です。未知suiteは拒否し、全領域の同一run identity・成功exit receipt・必須payloadが揃わなければ集約を失敗させます。`parallel-browser-suites.test.mjs` が欠落・改変・前回report・nonzero exitを実際の集約入口に与えて確認します。

| suite | 責務 | 変更時の注意 |
| --- | --- | --- |
| home-content | 更新情報、実記事、日付fixture、順序・ラベル・表示幅 | 記事・公開状態・日付・タイムゾーンに依存。毎回検査する領域 |
| home-shell | 写真、header遷移、画像失敗時、文字拡大、共有header、homeのtool行 | CSS/JS/font/画像に加え、更新欄の位置・footer導線にも依存 |
| navigation | header検索、mobile menu、各幅のnavigation、copy成功/失敗 | homeだけでなくabout/search/tool等の実ページも使用 |
| carousel-desktop / carousel-mobile | 端末別操作、実時間autoplay、focus、loop、reduced motion | 実homeの周辺layout・data・字体に依存。固定fixtureだけの検査ではない |
| remaining | 記事metadata・search・tag・footer・contact・design role | 全体検索/関連記事/更新日時等を含む現buildの検査 |
| tools | tool導入・host接続・private preview・Prime smoke | 製品側の数値アルゴリズムmatrixを重複させない |

Common Toolは従来どおり独立した必須jobです。old home-navigationの全assertionはhome-content→home-shell→navigationの順に集約し、axe報告の順序と重複回数を維持します。fresh processごとにnetwork/media/service-worker/viewportを復元します。navigationは旧home-shell終了時の1487×1058から始めます。

**今回も全suiteを実行します。検査の省略はまだ有効ではありません。** 単なる変更pathやDOM断片一致では、隣接要素の高さ、ancestor属性、font subset、共有JS/CSS/CSPの影響を否定できません。home-shellに残るtool/footer/更新位置検査を無視して「header未変更だから省略」と判定しません。

次の選択実行は、固定fixture上の部品機能matrixと毎回の実ページ統合検査をさらに分離した後に実装します。成功済みbaseのexact source/run/attempt・suite・toolchainと、headの入力/配布依存の一致を証明できる範囲だけを候補にします。未知・欠落・共有変更・releaseではfullへ戻し、旧成功reportを現buildのPASSとして転記しません。main/releaseは全検査を維持します。

記事増加に伴う公開build・検索索引・全リンク整合性の計算量をこの分割で解消したとは扱いません。今回短縮するのは独立検査の直列待ちです。効果は個々のsuite時間の合計ではなく、同時実行の最長経路とCI全体の実経過時間で確認します。
