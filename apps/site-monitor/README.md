# Site monitor: offline candidate

[運用候補](../../docs/operations/site-monitor-direct-email-proposal.md)の毎時Worker。公開Siteへのbinding追加ではなく、別Worker候補。現在は未導入・Cronなし・MONITOR_ENABLED=false。実provider GET/メール送信/設定変更は禁止された作業範囲で実装・合成検証する。

`baseline.mjs`は公開済みreleaseと写真13表を固定し、将来の本人承認private baselineと宛先hashを検査する。`inspect.mjs`は既存Cloudflare shape helperを再利用し、GETだけで構成/公開応答を判定。`worker.mjs`は固定KV keyの状態を先に保存して初回異常/重要理由変更だけ通知する。正常と復旧は無送信、incidentは自動解除しない。

`wrangler.offline.jsonc`はローカルbundle専用。宛先/secret/KV namespace/Cron/bindingは含まないため本番設定ではない。binding不足のまま有効化してもCONFIGURATION_NOT_READYで止まる。実設定用configは本人が運用候補の一括判断を採用した後で作成する。

ローカル検証（ネットワークと実bindingなし）:

```text
node node_modules/vitest/vitest.mjs run apps/site-monitor/worker.test.ts
node --test scripts/release/manual-deployment.test.mjs scripts/release/manual-deployment-readiness.test.mjs
WRANGLER_SEND_METRICS=false node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config apps/site-monitor/wrangler.offline.jsonc
```

Vitestは既存root includeに入り、既存CI producerで検証される。Workflowの追加/編集はない。既存manual-only deploy workflowはpush/PRでdeployしない。

合成E2Eは全13写真/非公開2endpoint、最大8ページhistory、通知抑止、incident保持、UNKNOWN、state異常、ambiguous送信、duplicate slot、JSON/IO上限を確認する。写真digestは合成fixtureでモデル化し、実写真の検証とは区別する。native CPU10msとメール受領は未検証。KV競合時の重複例も試験し、exactly-onceを主張しない。
