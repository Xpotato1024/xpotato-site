# Editor API

公開サイトWorkerとは別の、所有者限定のGit・私有媒体APIです。

- `GET /editor-api/session`: ログイン状態。トークンは返しません。
- `GET /editor-api/connection`: 認証後にGitHubとDraft R2の読取り接続を確認。
- `/auth/start` → `/auth/callback`: GitHub App OAuth、PKCE、一時state、対象installation確認。
- `/branches`、`/snapshot`、`/manifest`、`/documents`、`/document`: 固定commitの読取り。
- `POST /branch`、`/save`、`/pull-request`: `content/`作業ブランチと下書きMDXの保存。
- `/drafts`、`/draft-state`、`/media/*`: 私有媒体の予約、照合、読取り、棄却、復元。
- `POST /github/activity`: GitHub署名付きpush通知による編集時刻の同期。
- `GET /gc/plan`: 削除候補の読取り確認。

実環境の接続は[CMS接続手順](../../docs/operations/editor-connection.md)から行います。
対象のWorker・bucket・routeはServerの固定版から解決し、接続CLIが設定を生成します。
秘密値はWorker Secretsへ保存し、Gitやブラウザへ配布しません。

このディレクトリのWrangler設定はローカル開発とbundleのdry-runに使います。
`wrangler deploy --dry-run`は実配備ではありません。実配備は上記の接続CLIを使います。
APIは公開A/B/Cを操作せず、GCは保持・復元の実環境確認まで無効です。
