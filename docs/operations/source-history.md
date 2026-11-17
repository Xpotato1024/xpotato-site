# 過去版の調査と復旧

旧移行CLI、廃止operator、旧workflow、過去のsetup文書を現在のmainにコピーして保持しません。削除前の固定commitは `62936f765efcc5ab7db0508c06de392e64edef5a` です。

```sh
git show 62936f765efcc5ab7db0508c06de392e64edef5a:旧path
git worktree add --detach ../site-history-review 62936f765efcc5ab7db0508c06de392e64edef5a
```

履歴の調査と、現行環境への復元・本番実行は別です。旧コードを調べてもsecretやprovider操作を自動で有効化しません。古いProduction artifactの復旧が必要な場合は、そのartifactに対応する固定版consumerと当時の契約を明示的に選択します。現在のconsumerへ旧layoutや過去hashの例外を追加しません。

現行ContentId、旧URL対応、公開保留、媒体権利・来歴は現行Registryに保持され、通常CIで検証されます。これらは廃止済みコードではありません。
