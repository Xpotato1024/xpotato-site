export const errorLabel = (message: string) =>
  (
    ({
      GIT_CONFLICT:
        "他の端末またはAIがブランチを更新しました。手元の下書きは保持しています。最新版を別の下書きとして読み込み、差分を確認してください。",
      PR_NOT_DRAFT: "このブランチにはレビュー中のPRがあります。既存PRを確認してください。",
      AUTH_REQUIRED: "GitHubへの接続が必要です。",
      AUTH_EXPIRED: "接続の有効期限が切れました。ローカルの下書きを保持したまま再接続できます。",
      AUTH_NOT_CONFIGURED:
        "GitHub Appの接続設定はまだ有効になっていません。ローカル編集・MDX書き出しを利用できます。",
      API_NOT_AVAILABLE: "同期APIに接続できません。編集内容はこの端末に保存できます。",
      HEIC_CONVERSION_REQUIRED:
        "この端末ではHEICを変換できません。原本は削除していません。対応する端末または専用の媒体変換コマンドで変換してください。",
      MEDIA_BYTES_LIMIT:
        "最適化後の保存上限を超えています。文字や動きを無断で削らず、縮小・構成変更または例外の確認が必要です。",
      INPUT_BYTES_LIMIT: "取り込み元は24 MiB以下にしてください。",
      DRAFT_QUOTA_EXCEEDED: "下書き画像の容量上限に達しました。既存の画像は保持されています。",
      EDITOR_CONTRACT_VERSION_UNSUPPORTED:
        "このブランチの編集契約に対応していません。対応版のCMSで開いてください。",
    }) as Record<string, string>
  )[message] ?? message;
