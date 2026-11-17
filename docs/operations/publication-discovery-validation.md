# 公開ページ・検索の検証

`npm run site:output:check`は現在の`apps/site/dist`と共通catalogを直接比較します。公開URL、ContentId、indexable集合、一覧/分類/タグ/RSS、検索文書、リダイレクト、内部リンク、runtime/CSP、ローカルGET/HEADの一致を確認します。サイトとCMSをここで再buildしません。

未承認記事は`content/registry/publication-holds.json`、旧URL対応は`article-url-history.json`、WordPress queryのprovider要件は`provider-redirects.json`に保持します。holdの本文/IDや現在の公開媒体を旧移行コードと一緒に消しません。provider要件の静的検査は、実Cloudflare設定や本番readbackを完了したという意味ではありません。

通常の下書きはCMSの編集プレビューと固定commitのAstroレビューで確認します。旧Phase 8の44記事すべてを仮公開するfixtureや専用preview実装は使いません。必要な過去の調査は[固定Git版](source-history.md)で行います。
