---
status: proposed
owner: development
last_verified: 2026-11-03
---

# PR141の全体整理と確認範囲

この記録はPR141の開発差分であり、main採用・本番移行の証拠ではない。日常の入口は[4経路](content-workflows.md)、現配置と画像対応は[所有表](repository-ownership.md)。初期構想のdirectory名を守ることより、実callerと正本を一致させることを優先した。

| 調査対象 | 結果・変更 | 維持する境界と確認 |
|---|---|---|
| root全file・hidden support | 旧src/public/旧Astro・Tailwind・Wranglerを撤去。Node/npm/TS/VitestとGit設定だけ維持 | workspace設定は現役。Nodeの2version fileは同一値をtoolchain検査。秘密・private出力をGitに追加しない |
| .agents | 4編集経路のrepo内skillを実CLIと同期 | global skillを編集しない。skillは公開/承認権限の代わりではない |
| .github | caller・scope分類を新pathへ更新。重複の配信workflowテンプレートを削除 | 実workflow1本とexact sourceSHA検査。owner/main/manual/Environment/固定Production条件、permissionsは維持 |
| apps/site | frontend helperをarticles/content/discovery/home/media/tools別に配置。Primeの法的offerはlicenses/prime-factorizerへ | content・route・Registryはサイト所有。記事本文/URL/権利は不変。法的offerは固定commitのGitリンク、旧リンクは当時のGitで維持 |
| source-inputs・public | 既存原画像9件を非配信のSHA格納へ同bytes移管。home recipeを同所有へ | 原画像9件4539337 bytesをexact catalog検査。公開font375fileは配信URLと生成規則により同directoryを維持。R2の公開/保護条件をGit復元に置換しない |
| config | font recipe/期待出力、performance予算、監視baselineを実入力として集約 | 値・上限・font bytes・UNINITIALIZED状態を変更しない。承認記録はここへ混ぜない |
| packages/content-contracts | article/migrationを分離、schema出力8領域へ | Zodが正本。82schemaのclean生成/余分・欠落・古いfile拒否。小さい共有contractは無意味に細分化しない |
| packages/site-validators | migration/browser-tools/prime/deliveryを分離 | 読取りbuilder・再検査を共有。canonical writerはtools。npm/package export名を維持 |
| packages/article-pipeline | candidate/review/publication/media/visualを分離。旧operator3adapterをtest-supportへ | 現役SDK保存は1経路。read-only descriptorは現役inspect-session用。旧transportをpublic indexから外し、否定系試験を維持 |
| 他packages | media-ingest/example-verifier/portable-contentは小さく単一責務のため現構成を維持 | media処理・sandbox・portable構文をsite runtimeへ混ぜない。provider依存はarticle側だけ |
| schemas | generatedをcontent/interactive/article/media/disclosure/examples/migration/publicationへ。manual release schemaはreleaseへ | IDとschema bytesは不変、生成器・参照側を同時更新。手作業の二重schemaを作らない |
| scripts | rootはCI分類とgraph。releaseをartifact/deployment/monitoring/sharedへ | 現役callerのある運用コードだけ。旧curl/importerを復活しない。監視の移動は再実行/再承認ではない |
| tools | authoring/build/qa/publication/migration/review/assets。reviewをarticles/blog/prime/site、home buildを専用folderへ | 作成/書込と検査を分離、安定npm名を維持。既成稿producer7本を新配置に更新。過去hash固定証跡は当時のGitで再現 |
| templates・tests | content/toolの開始sourceとmonitor例をtemplatesへ。synthetic入力はtests/fixtures | ダミーは隔離workspaceのみ。testは原則実装の隣。fixtureを正式記事・receiptにしない |
| docs全subtree | 運用ガイドを現経路へ修正。機械入力と同じものを文書側に残さず、期限付き準備/承認/監視証跡をhistory/acceptanceへ | contracts/architectureは目的別の既存索引を維持。ADR・44記事移行・過去auditの固定事実を現状態へ改竄しない。旧案内stubを撤去 |
| vendor | 選択v0.2.2を維持、未選択旧6版489fileは固定main祖先から同bytes復元 | 全7pin検査、旧版の復元・filesystem選択試験、license supplementを維持。release bytesの再生成/書換えなし |

## 撤去と運用移行を区別する

旧root124fileと旧vendor489fileの計613fileは、[撤去表](../migration/reproducible-copy-retirement-plan-v1.json)とimmutable Git復元によって作業treeから撤去した。9原画像は廃棄せず実移管した。旧44記事の公開hold、ContentId/URL履歴、画像の真正な公開・保護・復旧、実cutover/本番rollback受入れは別の実証条件として残る。Git履歴があることをR2保護や公開移行完了の代わりにしない。

## 検証の意味

4経路smokeは記事Job/固定page/tool生成/style更新を隔離して検査する。全経路の本番E2Eではない。通常CIではunit/Node release/型/Astro/build/実dist結合/性能/interaction/Windows consumerと、固定legacyの再現・media/route holdを検査する。layout変更だけで本文画像根拠の全面AI監査はやり直さない。

font生成は同じ固定FontTools/Brotliで4core bytesを再現する。schema・移管JSON・原画像・選択vendorはexact bytesを比較する。実distはURL/content/media構成を比較し、固定build revisionとPrime offerの所有path、font SOURCESの入力案内以外に意図しない差がないか確認する。これらは新CSP緩和・provider変更・本番配信の許可を与えない。

## 残すもの

現役・単一責務の共有code、試験に使う凍結証跡、法的notice、未公開44記事と原画像のholdは残す。public font filenameやarticle URLを見栄えのために変更しない。新しいサービス/鍵/常設operatorや転送stubは追加しない。mainの採用と配信は後の個別判断であり、このDraft PRでは実行しない。
