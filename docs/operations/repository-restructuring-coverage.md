---
status: proposed
owner: development
last_verified: 2026-11-03
---

# PR141の全体整理と確認範囲

現在の参照先: 以下はPR141作業時点の記録です。[PR141](https://github.com/Xpotato1024/xpotato-site/pull/141)は2026-11-04に`2850960722b46217329db78957c67b3086bee188`でmainへ統合済みです。本文の「Draft」「全7pin」「選択v0.2.2」等は当時の状態として保持します。現況は[所有表](repository-ownership.md)と[vendor README](../../vendor/README.md)、追加整理の準備は[2026-11-09計画](repository-hygiene-plan-20261109.md)を参照してください。統合を本番cutover受入れの証明にはしません。

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
| schemas | generatedをcontent/interactive/article/media/disclosure/examples/migration/publicationへ。manual release schemaはreleaseへ | 配置整理のIDとbytesは保持。共通更新対応ではpublication.revisionを後方互換追加し、影響する生成schema2件を更新。生成器・参照側を同時更新し、手作業の二重schemaを作らない |
| scripts | rootはCI分類とgraph。releaseをartifact/deployment/monitoring/sharedへ | 現役callerのある運用コードだけ。旧curl/importerを復活しない。監視の移動は再実行/再承認ではない |
| tools | authoring/build/qa/publication/migration/review/assets。reviewをarticles/blog/prime/site、home buildを専用folderへ | 作成/書込と検査を分離、安定npm名を維持。既成稿producer7本を新配置に更新。過去hash固定証跡は当時のGitで再現 |
| templates・tests | content/toolの開始sourceとmonitor例をtemplatesへ。synthetic入力はtests/fixtures | ダミーは隔離workspaceのみ。testは原則実装の隣。fixtureを正式記事・receiptにしない |
| docs全subtree | 運用ガイドを現経路へ修正。機械入力と同じものを文書側に残さず、期限付き準備/承認/監視証跡をhistory/acceptanceへ | contracts/architectureは目的別の既存索引を維持。ADR・44記事移行・過去auditの固定事実を現状態へ改竄しない。旧案内stubを撤去 |
| vendor | 選択v0.2.2を維持、未選択旧6版489fileは固定main祖先から同bytes復元 | 全7pin検査、旧版の復元・filesystem選択試験、license supplementを維持。release bytesの再生成/書換えなし |

## 撤去と運用移行を区別する

旧root124fileと旧vendor489fileの計613fileは、[撤去表](../migration/reproducible-copy-retirement-plan-v1.json)とimmutable Git復元によって作業treeから撤去した。9原画像は廃棄せず実移管した。旧44記事の公開hold、ContentId/URL履歴、画像の真正な公開・保護・復旧、実cutover/本番rollback受入れは別の実証条件として残る。Git履歴があることをR2保護や公開移行完了の代わりにしない。

## 検証の意味

4経路smokeは記事Job/固定page/tool生成/style更新を隔離して検査する。追加のtools:smokeは同期型/Worker型の2toolを共通installerで新規登録・公開済み更新し、隔離した実Site build/manifest/CSP/静的受入れを実行する。Chromeではその同じ隔離出力を操作し、PC/狭幅PNG・入力拒否・escape・取消/再実行・offline・Worker/URL解放を検査する。全経路の本番E2Eではない。通常CIではunit/Node release/型/Astro/build/実dist結合/性能/interaction/Windows consumerと、固定legacyの再現・media/route holdを検査する。layout変更だけで本文画像根拠の全面AI監査はやり直さない。

font生成は同じ固定FontTools/Brotliで4core bytesを再現する。schemaは正本からのclean生成一致を、移管JSON・原画像・選択vendorはexact bytesを比較する。実distはURL/content/media構成を比較し、固定build revisionとPrime offerの所有path、font SOURCESの入力案内以外に意図しない差がないか確認する。これらは新CSP緩和・provider変更・本番配信の許可を与えない。

## 共通ライフサイクルの追加確認

[ADR-0067](../design/adr/0067-common-content-lifecycle.md)により初記事限定・Prime専用の現役移行/更新/公開gateを撤去した。全toolの現在pin検査は登録済みrouteとexact admission、Worker/WASMのCSPと固定font sourceから導出する。履歴全pinの実bytes検査は通常のinstallation/source gateに集約し、表示/予算など各consumerで旧6版を繰り返し読み直さない。履歴registryは正規importとObject.freeze literalだけを許し、未知spreadや実行factoryを拒否する。旧runtime互換とlicense補遺は歴史pinの復旧検査専用であり、新candidateへ転用しない。

記事の新規/更新は同じ正式Job・prepare/publishで、更新前4file/compact recovery/実Git祖先を保存前に照合する。旧版objectと復旧PR用patchを保持する。検索の合成記事はtests/fixtures/searchへ移し、通常content/mediaから除外した。内部collectionのblogは安定schema識別子として保持し、公開URLはarticlesのまま。旧44記事の公開hold/cutover条件を共通化の名目で解除しない。

## 残すもの

現役・単一責務の共有code、試験に使う凍結証跡、法的notice、未公開44記事と原画像のholdは残す。public font filenameやarticle URLを見栄えのために変更しない。新しいサービス/鍵/常設operatorや転送stubは追加しない。mainの採用と配信は後の個別判断であり、このDraft PRでは実行しない。
