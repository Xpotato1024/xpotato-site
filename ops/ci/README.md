# 現行CI

通常CIは`.github/workflows/ci.yml`。同じsource revisionの検査とartifactだけを使用し、別runやcacheのPASSを流用しません。

- scope: 変更範囲の分類。未分類は検証を省かない。
- offline-policy: 現在の配信・権限・復旧の失敗境界。秘密情報・provider操作なし。
- source-validation / publication-fixtures / common-tool: 独立した並列検証。
- producer: siteとeditorを各1回buildし、そのdistを並列ブラウザ・契約検査へ渡す。
- windows-consumer: 同じLinux artifactをWindowsで検証。再buildしない。
- result: 必須jobの結果を集約。

`ci-impact.mjs`の詳細分類は観測用です。これだけを理由に必須検査を省きません。旧移行inventory/baseline再生成や合成receiptを運ぶ16step・90秒待機は通常CIに含めません。

公開は独立した手動workflowと保護Environment。監視は現行の定期・手動操作を保持し、本cleanupではactivationや通知設定を変更しません。
