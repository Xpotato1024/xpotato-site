---
status: accepted
owner: architecture
last_verified: 2026-11-18
---
# ADR-0082: 所有者CMSのnative接続手順

## 背景

CMSのコードと合成試験は成立したが、GitHub AppとR2の実接続が未完了。本人が複数のsecretを手作業で転記する仕組みや、新しい常駐サーバーを増やす必要はない。

## 判断

GitHubのApp Manifest登録とWrangler login/secret bulk/deployを使用する。登録画面は本人が操作し、秘密値をチャット・作業ファイルへ出さない。権限にはPR check-runsに必要なChecks readを含め、installationが所有者の対象repository一つだけであることをsession発行前に確認する。

Siteはコードと認証・権限を、Serverは専用Draft bucket/API routeの値とprovider readbackを所有する。対象以外のWorker/R2への書込み権限をruntimeへ渡さない。操作はcleanな統合済みの組に限定し、ServerはSiteのInfrastructure Handoffに記録するCMS専用revisionへ固定する。通常の公開Site/A/B/C配信契約とそのcounterpartを変更しない。

初回接続は独立した一回性操作。汎用reconciler、secret保管DB、専用workflowは追加しない。接続状態の表示はGit/R2の読取り結果を分け、記事保存や公開と同一視しない。未接続でもローカル編集・書出しを維持する。

## 受入れ

標準bundle・実workerd/R2・元のブラウザ統合試験を使う。本人Cloudflare login、App登録/installation、公開Siteの保護Environment承認は代行したと偽らない。費用・実機・GC有効化は実観測後に記録する。

手順の正本: [editor-connection](../../operations/editor-connection.md)。本ADRは実リソース作成や本番稼働の完了記録ではない。
