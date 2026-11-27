# 現行CI

通常CIは`.github/workflows/ci.yml`。同じsource revisionの検査とartifactだけを使用し、別runやcacheのPASSを流用しません。

- scope: 変更範囲の分類。未分類は検証を省かない。
- offline-policy: 現在の配信・権限・復旧の失敗境界。秘密情報・provider操作なし。
- article-fast: 候補の旧新原稿・CMS索引を意味判定し、未公開の編集だけ全体build/static/publication/performance/route/search検査へ進める。既存公開記事を同じContentIdで改稿するcontent/* Draft PRでは、headの原稿・索引・held状態・正式Astro描画を検証し、公開検査は別worktreeのexact baseで実施する。公開成果物を昇格する経路ではない。改稿候補の本文hashを公開版の正規来歴へ先行して書き込まない。公開版の正規来歴はbaseの全文検証で照合し、headは変更範囲・CMS契約・分類・catalog・Astro描画で検査する。不適格なら全体CI。
- article-regression: 全体CIで同じ短経路を合成CMS編集に対して実行し、公開出力への混入を検査する。
- source-validation / publication-fixtures / common-tool: 独立した並列検証。
- producer: siteとeditorを各1回buildする処理とWebKit導入・Chromeフォント準備を並行する。次stepで同じdistのWebKit検査と全public検査を並行し、両方成功後にgate・packageへ進む。
- windows-consumer: 同じLinux artifactをWindowsで検証。再buildしない。
- result: 必須jobの結果を集約。

`ci-impact.mjs`の詳細分類は観測用です。これだけを理由に必須検査を省きません。旧移行inventory/baseline再生成や合成receiptを運ぶ16step・90秒待機は通常CIに含めません。

記事更新の待ち時間はjobの延べ時間ではなく、必要な結果が揃うまでの実時間で評価します。CMSの正式Astroレビューは別の`editor-preview.yml`で動き、通常CIの完了を待ちません。scopeはNode標準APIだけで変更記事を選び、依存導入と実描画・MDX検証をreview jobへ集約します。測定値と実行の境界は[CI時間の測定](../../docs/operations/ci-performance.md)を参照してください。

対象条件と全体CIへのfallbackは[下書きCI](../../docs/operations/ci-change-impact.md)に記載。mainの原稿・コード変更は全体検証、PRは `ci:full` labelでも全体検証を要求できます。下書き用CIはrelease artifactを作りません。

公開は独立した手動workflowと保護Environment。監視は現行の定期・手動操作を保持し、本cleanupではactivationや通知設定を変更しません。
