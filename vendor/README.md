# 固定ブラウザツール

選択版の正本は[installations.json](../config/browser-tools/installations.json)。現行サイトはそこに指定されたimmutable Releaseを`vendor/browser-tools/`から使います。READMEへ最新versionを転記しません。

過去版の実体をworking treeに重複配置しません。復元元とhashは[history.json](../config/browser-tools/history.json)と[retained-source-index.json](../config/browser-tools/retained-source-index.json)で管理し、必要な明示rollback操作で固定Git版から復元します。復元だけで選択・掲載・公開を行いません。

追加・更新は`browser-tools:install`のplan/apply/check。生成wrapper、Registry、lock、licenseを別々に手修正しません。現行版の実体不足・変更を履歴fallbackで隠さず失敗とします。ソース提供・license補足は有効な配布契約として保持します。
