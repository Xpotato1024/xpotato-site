---
status: proposed
owner: development
last_verified: 2026-11-17
---

# CMS基盤実装の状態

この文書は実装候補の状態を記録する。既存サイトの本番配信、GitHub App登録、R2 resource作成、認証API activation、記事の公開を実施した記録ではない。

## 目的と実装境界

通常記事は公開GitHubの作業ブランチとDraft PRで人間・AIが引き継ぐ。本文の正本はMarkdown/MDX。画像は端末内の編集キャッシュと、本人認証された専用Draft R2へ保存する。CMSの操作に公開A/B/Cの削除権限を与えない。

- `content/`: 記事、メモ、制作物、ツール紹介、固定ページとregistry。URLとContentIdは変更しない。
- `apps/site/src/features/`、`shared/`: 公開サイトの機能と部品。共有デザイン値・font-faceは`packages/design-system/`。
- `apps/editor/`: source-preservingブロック編集、MDX編集、ローカル保存、Gitブランチ・Draft PR、媒体同期。
- `packages/editor-core/`: 下書き契約、Git競合、共通部品、容量、保管期限の機械的正本。
- `apps/editor-api/`: owner-only GitHub App認証、Git API adapter、私有R2への限定操作。既存公開Workerと独立した権限境界。
- `ops/`: 制作、変換、検証、公開実行。公開は従来の承認・固定成果物・手動Environmentを維持する。

## 歴史的記録と今回の配置変更

旧記事・媒体・公開来歴の本文とJSONはbyte-identicalで移す。過去の移行記録のtargetPathは書き換えず、`content-layout-paths.ts`が実ファイル読取り時だけ対応付ける。
ホーム画像は23objectの内容・大きさ・hashと表示プロファイルの一致を検証してから、実装ファイルの配置変更によるsource hashだけを新たに記録する。以前のreviewed recipeと手動workflowは`docs/history/cms-layout-20261117/`へそのまま保存する。既存の本人承認を新たな本人承認として作成しない。

## 検証の区別

ローカルの単体テスト、実Chromium上の操作、GitHub-hosted CI、実GitHub App認証、実R2保存、iPhone実機は別の検証である。合成store/APIのテスト成功を外部サービスでの動作確認と呼ばない。

現在の差分は未採用の実装候補である。固定commitとCIの結果、残る設定依存、実操作の未検証箇所はPRへ記録する。Secretsや私有媒体をCI artifactへ含めない。

## 外部環境に必要な準備

GitHub Appのclient ID/secretと所有者限定installation、callback URL、署名付きpush webhook、およびCloudflareのDraft専用bucket/binding/API routeを実環境へ設定する必要がある。これらはGitに秘密値を置かず、専用のEnvironment/secret設定を利用する。

所有者のGitHub user IDは公開プロフィールで確認した190472511。許可対象repoはXpotato1024/xpotato-site。無認証アクセス、未知repo、mainへの直接書込み、公開媒体バケットへの操作は拒否する。GCは認証・activity同期・保持/復元の実環境確認まで無効とする。
