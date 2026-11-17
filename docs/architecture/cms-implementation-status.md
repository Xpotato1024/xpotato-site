---
status: canonical
owner: development
last_verified: 2026-11-17
---

# CMS基盤実装の状態

この文書はPR #217/#219でmainへ採用済みのCMSコードと、未完了の実環境接続を区別する。既存サイトの本番配信、GitHub App登録、R2 resource作成、認証API activation、記事の公開を実施した記録ではない。

## 目的と実装境界

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

CMSコードはmainへ採用済みであり、実環境の有効化はIssue #220で追跡する。固定commitとCIの結果、残る設定依存、実操作の未検証箇所はPRへ記録する。Secretsや私有媒体をCI artifactへ含めない。

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

## 正規レビューのブラウザ受入れ

実Astroの固定commit出力をCMSで開き、実際のCSSと非公開画像、同一source/hash、scriptを許可しないiframe、CSP違反ゼロ、390px横あふれなし、本文変更後の旧レビュー失効を確認した。Cookie/tokenや署名付きURLをレビューHTMLに埋め込まない。ZodのJITをschema import前に無効化し、unsafe-evalを追加しない。画像の遅延読込試験は画像をviewportへ移してからdecodeを確認する。

この表示試験を既存editor並列suiteの必須条件へ接続した。通常公開siteの再ビルドは行わず、固定記事の独立したreview用Astro buildだけを実施する。production artifactのbuild once条件は維持する。

## 最終の所有境界・成果物検証

ツールrendererのimport対応表はsiteのfeatures/tools/registryが所有し、content/registryはAstro componentやsite実装をimportしない。installerが同じconfigからdata recordsとrenderer adapterを各所有者へ生成する。両方の生成物を検査し、手書きの二重定義を作らない。

配布ZIPの許可にはeditor/manifest.webmanifestを正確なパスで追加した。任意のwebmanifest拡張子を一般許可せず、未知の名前・別階層・大文字違い・private bytes・symlinkの拒否をNode/Windows両consumerで維持する。
