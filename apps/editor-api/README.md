# Editor API（実装候補）

公開サイトWorkerとは別の認証・権限境界です。

- GET /editor-api/session: 接続状態（トークンは返さない）
- /auth/start → /auth/callback: GitHub App OAuth、PKCEと一時state
- /branches、/snapshot、/manifest、/documents、/document: 固定commitを読取り
- POST /branch、/save、/pull-request: content/作業ブランチと下書きMDXのみ変更
- /drafts、/draft-state、/media/*: 私有媒体の予約、照合、読取り、棄却、復元
- POST /github/activity: GitHub署名付きpush通知でAIの編集も保持期限へ反映
- GET /gc/plan: 削除候補の読取り専用確認

実環境のclient ID・secret・session暗号鍵・webhook secretは未設定です。
設定の存在とowner認証を確認できない場合は書込みを拒否します。

ローカル・合成テストは外部サービスにアクセスしません。wrangler deploy --dry-runは配備ではありません。
本番deployコマンド、公開A/B/C binding、CMSからのGC実行APIは提供しません。
