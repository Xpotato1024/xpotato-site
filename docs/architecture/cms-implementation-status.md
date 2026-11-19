---
status: canonical
owner: development
last_verified: 2026-11-19
---

# CMS基盤実装の状態

この文書はPR #217/#219でmainへ採用済みのCMS基盤、現在の機能ブランチで追加した編集画面、未完了の実環境接続を区別する。既存サイトの本番配信、GitHub App登録、R2 resource作成、認証API activation、記事の公開を実施した記録ではない。

## 2026-11-18 編集画面・連載の実装

以下は`3e0d12a890aba8370e880ffc6b586490bc9a4af3`を基準にした`feat/cms-workbench-series-20261118`のコードである。この記録自体はmainへのmergeや実サイトへの反映を示さない。採用状態は対応PR・commit、公開状態は[現行配信状態](../operations/current-deployment-status.md)で確認する。

| 項目              | 機能ブランチにある実装                                                                                                           | 区別する範囲                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 投稿先・記事情報  | 記事、メモ、教育記事、固定ページ、ツール、プロダクトの新規作成。目的・技術・話題タグの検索、分類とタグの追加、教育メタデータ。   | 教育は記事・メモの属性。既存原稿を別collectionへ移すUIは追加していない。                                     |
| 本文編集          | 元のMDXを保持する領域編集、文字装飾・リンク・引用・リスト・表、入れ子の部品、本文内ハンドルでの移動。                            | 未知構文は原文を保持してソース編集へ切り替える。全MDXをリッチエディタで再生成しない。                        |
| MDX・コード・数式 | 本文だけのCodeMirror、色分けと折り返し、コードの言語指定、公開側と合わせた`math` fenceのMathML表示。                             | 全体ソースはfrontmatterを読めない場合の修復用。通常コード中のTeXを勝手に数式化しない。                       |
| 添削              | 原稿上の引用・文脈・ブロックによる位置指定、指摘管理、修正案JSON、位置を再確認して部分適用。私有APIにreview revisionの比較更新。 | AI provider・Article Jobの自動起動は未接続。公開MDXへ私有の指摘を混ぜない。                                  |
| 履歴              | source・添削・registry変更の元に戻す／やり直す、端末の直近40件、復元前の保存、バックアップ取込時の別下書き作成。                 | 履歴は媒体ファイルやGit headを巻き戻さない。端末保存をGit保存・公開承認と区別する。                          |
| 即時プレビュー    | 実サイトのCSS・フォントを共有し、PC・タブレット・スマートフォン幅と表示倍率を切り替える。端末画像と安全なsemantic module描画。   | ASTによる即時表示。正規Astroの固定commitレビューは別経路。Demo等の実行・未対応部品を完全再現したとはしない。 |
| 連載              | 中央registry、CMSでの作成・所属・順序、サイトの前後リンク・目次・教育一覧。本文・registry・内容索引を同じGit commitで保存。      | 実registryは空。既存記事を自動登録せず、未公開・hold・noindexの項目を公開目次へ出さない。                    |

実装の責務と保存境界は[CMS編集画面の契約](../contracts/cms-workbench-contract.md)、順序と公開導出は[連載契約](../contracts/series-contract.md)、採用理由は[ADR-0083](../design/adr/0083-managed-series-reading-order.md)・[ADR-0084](../design/adr/0084-source-preserving-rich-cms-editor.md)を参照する。

本文の保持、部分置換、添削の位置、APIの競合拒否、未公開情報を除く連載、プレビューの非実行、追加フォントの遅延cacheに対する回帰試験を追加した。ローカル試験・production editor buildの記録はこのブランチの検証結果であり、以下に残す以前のブラウザー受入れや、未完了の外部接続を代替しない。新しい画面のIME・フォーカス・ドラッグ・モバイル表示の実行結果は、実際に試した対象buildとともに記録する。

CodeMirrorはCMS内の編集テーマをCSPに沿って適用するためopen ShadowRootを使う。Issue #218で延期している公開サイトのツール表示の隔離は別の課題であり、今回完了した扱いにしない。

## 2026-11-19 作業の入口と管理の独立

今回の追加はホームから作業を選ぶ構成であり、編集画面を開く前に投稿先・原稿・作業ブランチを決める。[ADR-0086](../design/adr/0086-cms-workflow-and-independent-registries.md)はこの機能ブランチの判断候補を記録する。以前の受入れ結果を今回の変更へ転用しない。

| 項目             | 今回の実装範囲                                                                                                | 検証・運用上の境界                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 作業の入口       | 新規作成、既存記事の改稿、下書きの続き。端末/Git原稿の検索と種別絞り込み、添削から開く選択。                  | ホームだけでは空原稿を保存しない。旧目録の欠落した公開状態は本文を読む前に確定しない。                       |
| 作業場所         | 編集前に新しい`content/*`、既存の`content/*`、この端末を選ぶ。固定commitから分岐する。                        | 改稿は同じContentIdの下書きとして開く。ブランチ作成と記事公開は別。                                          |
| 分類・連載の管理 | 記事に依存しない検索・追加、空の連載、読む順序、管理用Git保存・Draft PR。                                     | IndexedDB version 3の`workspace` storeへ独立保存。認証APIは許可操作・head・基準registry・参照先を検査する。  |
| 編集の表示       | ブロック・プレビュー・MDXを同階層のSVGタブへ統一。構成にはグループ番号と直下ブロック数。                      | 表示番号や選択状態を記事MDXへ保存しない。                                                                    |
| モバイル入力     | viewport変更後もcaretを確認し、入れ子のスクロール・固定バーを考慮する。キーボード表示中は下部メニューを隠す。 | フォーカス・selection・IME本文を変更しない。実iPhoneのキーボードは未受入れ。                                 |
| 添削の見え方     | 非編集中の本文に位置を照合した印、状態ラベル、提案の変更前/後。任意の操作サンプル。                           | 編集中のDOMやMDXに差分装飾を混ぜない。サンプルは模擬の端末データであり、AI呼出しや実記事の監査結果ではない。 |

### 操作部品・数式設定・追加の添削

2026-11-19の追加レビューで、CMSのボタン・入力欄・チェック項目を`apps/editor/src/ui/controls.css`のTailwind utilityへ集約した。共有design-systemの色・書体・操作領域を参照し、CMSのレイアウトと公開本文・プレビューの装飾を分離する。ホーム・開始・管理画面の飾りの英語見出しと重複した説明・導線を整理した。

数式の説明を読み戻す際に印刷設定まで取り込んでいた問題を修正し、印刷設定の切替で説明とTeX本文を保持する。添削状態ボタンは現在の対象へ直接つなぎ、追加の指摘には別IDを割り当てて反映済み履歴を保持する。未送信の入力は原稿・指摘先ごとのセッション状態へ移し、パネル切替で消さない。検証済みの対象commit・ブラウザー操作・Sites versionはPRの記録で照合する。

続くレビューでは、構成一覧に共通ボタンの中央寄せが影響していた問題を修正し、SVG・内容の抜粋・実際のブロック階層を表示する。本文上から未指摘のブロックや選択した文章への新規指摘を開く入口を追加した。境界の挿入操作は操作中の最内側のブロックへ絞り、共通の操作領域とキーボード経路を保つ。構成一覧のモバイル表示、新規指摘の引用・本文保持、挿入操作の到達性をブラウザー回帰の対象にする。

### 実装を探す入口

| 責務                         | ファイル                                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ホーム・原稿選択・管理の画面 | `apps/editor/src/features/workspace/WorkspaceHome.tsx`、`StartWorkspace.tsx`、`RegistryWorkspace.tsx`、`navigation.ts`、`workspace.css`。                                                                   |
| 管理状態・端末保存           | `features/workspace/useRegistryWorkspace.ts`・`registryState.ts`、`data/storage.ts`。記事の状態は`features/drafts/useDraftWorkspace.ts`。別ブランチ用の独立コピーと媒体の同時保存も`storage.ts`が所有する。 |
| 分類・連載の操作             | `components/TaxonomyManager.tsx`、`SeriesPanel.tsx`、`registry-management.css`。                                                                                                                            |
| ブランチ準備・registry API   | `features/git/useGitWorkspace.ts`、`data/api.ts`、`apps/editor-api/src/routes/git.ts`、`packages/editor-core/src/git.ts`・`registry.ts`。                                                                   |
| モード・構成                 | `features/editing/DocumentEditor.tsx`、`components/DocumentOutline.tsx`・`document-outline.ts`。                                                                                                            |
| viewport・caret              | `shared/useEditorViewport.ts`、`shared/editorFocus.ts`、`features/editing/SourceEditor.tsx`。環境hookから一度だけ接続する。                                                                                 |
| 添削表示・サンプル           | `features/review/review-marks.ts`・`ReviewIndicator.tsx`・`review-marks.css`、`components/blocks/BlockPreview.tsx`、`features/workspace/sampleDraft.ts`。                                                   |

先頭が`features/`・`components/`・`data/`・`shared/`のパスは`apps/editor/src/`からの相対位置である。公開サイトの構造を扱う`ops/design/inventory.mjs`へCMSだけのDOMを混ぜない。

### 今回の検証状態

`editorFocus.test.ts`はcaretの移動量・キーボード検出、`sampleDraft.test.ts`は独立ID・副作用なし・本文/画像/添削の整合、`storage.test.ts`は別ブランチ用コピーの本文保持・同期ID剥離・元データの独立をローカルで確認した。`useGitWorkspace.test.ts`は依存を模擬し、Gitから端末だけへ開く場合と新ブランチへの引継ぎで、画像・添削をコピーして旧私有IDを引き継がないことを確認した。グループ目次、添削表示、記事なしのregistry保存、派生目録にもそれぞれの回帰試験を追加している。全体の型検査・ビルド・統合試験の結果は、最終的な対象commitの結果で判定する。

2026-11-19にLLM-01のNode 24.22.1とEdgeでproduction editor buildを検証した。`editor-workspace-smoke.mjs`は3種類の入口、独立した管理、目的タグの原稿への引継ぎ、320pxの3モード、添削サンプル、IndexedDB v2からv3への原稿・媒体・履歴保持を確認した。`editor-keyboard-smoke.mjs`は320px/390pxでvisualViewportを模擬し、入れ子の本文、CodeMirror、通常フォームの計14ケースでcaretの可視性と保存済み全文・selectionの保持を確認した。既存`editor-browser-smoke.mjs`もrich/block/source、グループと画像の移動、数式・コード、mobile、offlineを通過した。

模擬イベントの成功を実iPhone・実IMEの受入れとして扱わない。最終commitの統合試験・GitHub CIとSitesへの反映は、対応PRに対象commit・versionとともに記録する。公開Siteの接続設定・実機受入れは引き続き別の確認項目である。

## 目的と実装境界

2026-11-19の追加レビューでは、執筆と原稿・連載・記事情報・履歴・保存確認を画面単位に分け、モバイルの常設ツールを構成・画像・添削へ整理した。見出し・本文・画像を明示的な`<Group>`でまとめ、全体移動・子の編集・解除を行える。公開Groupは子だけを描画し、既存記事を自動変換しない。[CMS編集画面の契約](../contracts/cms-workbench-contract.md)と[ADR-0085](../design/adr/0085-writing-workspace-and-explicit-groups.md)に記録し、対象commitの検証とSites反映はPRで区別する。

通常記事は公開GitHubの作業ブランチとDraft PRで人間・AIが引き継ぐ。本文の正本はMarkdown/MDX。画像は端末内の編集キャッシュと、本人認証された専用Draft R2へ保存する。CMSの操作に公開A/B/Cの削除権限を与えない。

- `content/`: 記事、メモ、制作物、ツール紹介、固定ページとregistry。URLとContentIdは変更しない。
- `apps/site/src/features/`、`shared/`: 公開サイトの機能と部品。共有デザイン値・font-faceは`packages/design-system/`。
- `apps/editor/`: source-preservingブロック編集、MDX編集、ローカル保存、Gitブランチ・Draft PR、媒体同期。
- `packages/editor-core/`: 下書き契約、Git競合、共通部品、容量、保管期限の機械的正本。
- `apps/editor-api/`: owner-only GitHub App認証、Git API adapter、私有R2への限定操作。既存公開Workerと独立した権限境界。
- `ops/`: 制作、変換、検証、公開実行。公開は従来の承認・固定成果物・手動Environmentを維持する。

## 歴史的記録と今回の配置変更

本文・媒体の実bytesと公開来歴は維持する。公開保留・分類・固定ページ来歴は現在のRegistryから直接検査し、旧pathの互換mapperを使わない。
ホーム画像は23objectの内容・大きさ・hashと表示プロファイルの一致を検証してから、実装ファイルの配置変更によるsource hashだけを新たに記録する。以前のrecipeと手動workflowは固定Git履歴へ戻せる。既存の本人承認を新たな本人承認として作成しない。

## 検証の区別

ローカルの単体テスト、実Chromium上の操作、GitHub-hosted CI、実GitHub App認証、実R2保存、iPhone実機は別の検証である。合成store/APIのテスト成功を外部サービスでの動作確認と呼ばない。

PR #217/#219のCMS基盤はmainへ採用済みであり、実環境の有効化はIssue #220で追跡する。冒頭の新しい編集画面・連載機能は機能ブランチの実装として区別する。固定commitとCIの結果、残る設定依存、実操作の未検証箇所はPRへ記録する。Secretsや私有媒体をCI artifactへ含めない。

## 外部環境に必要な準備

GitHub Appのclient ID/secretと所有者限定installation、callback URL、署名付きpush webhook、およびCloudflareのDraft専用bucket/binding/API routeを実環境へ設定する必要がある。これらはGitに秘密値を置かず、専用のEnvironment/secret設定を利用する。

所有者のGitHub user IDは公開プロフィールで確認した190472511。許可対象repoはXpotato1024/xpotato-site。無認証アクセス、未知repo、mainへの直接書込み、公開媒体バケットへの操作は拒否する。GCは認証・activity同期・保持/復元の実環境確認まで無効とする。

## 2026-11-17 統合検証の修正

CMSのJavaScriptは専用の `/editor/` と `/editor/assets/` に限定する。公開記事のゼロruntime条件、検索・Toolとの依存分離、外部import拒否は維持し、CMSだけに独立した転送量予算を適用する。CMSのシェルはnoindexであり、記事としてcanonical/descriptionを要求しない代わりに専用のHTML契約を検証する。他の経路のSEO要件は変更しない。

ディレクトリ移設後の比較は、既存本文60ファイルのbyte同一性と、公開ページの意味・メタデータ・画像参照・導線を検証する。生成スクリプト内の変数名、当該build commitに結び付く対応ソースリンクだけは明示的に区別する。任意のURL差分や本文差分は無視しない。runtime/CSS/操作は別の最終成果物検証で確認する。

## 追加した実処理とレビュー経路

- HEIC: privateな入力を期限付きworkerでdecodeし、共有プロファイルに従ってマスターとプレビューを生成する。公式libheifの公開サンプルで実decodeを確認した。iPhone実機の操作試験とは区別する。
- GIF: フレーム間隔、順序、loopの同値を確認する既存媒体処理を利用し、可逆animated WebPへ変換する。通常写真と同じlossy設定にしない。
- 専用処理からCMSへの受渡し: privateな媒体JSONの容量、hash、画像形式、寸法を読み込み時に再検証する。自動アップロードや公開はしない。
- Astroレビュー: 公開Draft PRの固定commitから、正規のAstroレイアウトと図表・数式・CSSで表示パッケージを作る。公開CIに私有画像を渡さず、認証済みブラウザでassetId/hashと照合して結び付ける。本文・媒体revisionが変われば表示を失効させる。iframeはscript/フォーム/リンク遷移を許可しない。

具体的な操作入口と接続準備は[CMS制作手順](../operations/editor-workflow.md)、設計判断は[ADR-0079](../design/adr/0079-public-git-cms-private-media-staging.md)を参照する。

## 2026-11-17 正規レビューのブラウザ受入れ記録

実Astroの固定commit出力をCMSで開き、実際のCSSと非公開画像、同一source/hash、scriptを許可しないiframe、CSP違反ゼロ、390px横あふれなし、本文変更後の旧レビュー失効を確認した。Cookie/tokenや署名付きURLをレビューHTMLに埋め込まない。ZodのJITをschema import前に無効化し、unsafe-evalを追加しない。画像の遅延読込試験は画像をviewportへ移してからdecodeを確認する。

この表示試験を既存editor並列suiteの必須条件へ接続した。通常公開siteの再ビルドは行わず、固定記事の独立したreview用Astro buildだけを実施する。production artifactのbuild once条件は維持する。

## 最終の所有境界・成果物検証

ツールrendererのimport対応表はsiteのfeatures/tools/registryが所有し、content/registryはAstro componentやsite実装をimportしない。installerが同じconfigからdata recordsとrenderer adapterを各所有者へ生成する。両方の生成物を検査し、手書きの二重定義を作らない。

配布ZIPの許可にはeditor/manifest.webmanifestを正確なパスで追加した。任意のwebmanifest拡張子を一般許可せず、未知の名前・別階層・大文字違い・private bytes・symlinkの拒否をNode/Windows両consumerで維持する。

## 2026-11-18 初回接続の実装

初回設定を標準GitHub App ManifestとWranglerへ接続するCLI、App/所有者/対象repositoryの照合、認証後のGit/R2接続状態表示を追加。Serverがprovider値と限定readbackを所有する。操作方法は[接続手順](../operations/editor-connection.md)。

初回接続の検証時点ではWrangler未認証、公開/editor/と/editor-api/sessionは404と観測した。この観測を新しい編集画面の実環境配信確認とは扱わない。実App登録・R2作成・公開Site配信は未実施。これらが完了するまでIssue #220を閉じない。
