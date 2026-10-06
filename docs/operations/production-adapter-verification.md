---
status: code-and-mock-verified-live-pending
owner: operations
last_verified: 2026-10-06
---

# 方式B adapter：コード検証とlive接続の境界

tokenを先行発行しない方針で、値を使わずに実装可能な部分を進めました。実adapterをproduction workflowへ接続したり、本番mutationを呼んだりしていません。全API testは合成mockのみです。

## 実装した部分

| module | 実装とfail closedの条件 |
| --- | --- |
| `deployment-http.mjs` | 明示注入したfetch/credential callbackだけ使用。origin/path/methodを固定、redirect拒否、body上限1MiB、資格情報取得も含む10秒以内timeout、mutation再試行なし、provider error/body/secretを例外へ反映しない |
| `deployment-cloudflare.mjs` | site-read/audit-read/token-revoke/endpoint-containを分離。実verify ID、Worker name/tag、raw policy/permission ID/resource mapの照合、期限、pagination、active deployment/version/100% traffic、settings/version bindings=0、全account zonesのroutes、custom domain、両endpoint flag、snapshot中のdriftを検査。独立operatorのraw policyもreview済みauthorityと比較し、list-selfや権限不足を完全inventoryと呼ばない |
| `deployment-data-plane.mjs` | verified artifactから渡すhome hash/公開content markerを使いpublic byte一致を検査。実version UUIDの先頭8文字からVersion URLを作り、workers.devと実Version URLの404/content不在を確認。認証headerなし、redirect/403/timeoutはunknown。応答本文を出力しない |
| `deployment-github.mjs` | raw main/Environment/branch policy/Secret**名**metadataとexact run/approval historyをGET。Admin bypassは実GETのfalseを要求し、field欠落時だけ別認可済みのfresh UI readback callbackを要求。403を無保護/不存在と扱わない。review historyがattemptを識別しないためproduction attempt1のみ対応し、再試行は新しい手動dispatchを必要とする |
| `deployment-supervisor.mjs` | deploy job外のindependent host用controller/explicit loop。本人のarm認可とfresh独立capabilityを要求し、GitHubのauthenticated run状態を監視。cancel/failure/timeout/identity drift/unknown/hung callback/未確認postcheckでsame-ID revokeとcontainmentを各1回試みる。revoke失敗でもcontainmentを試み、未知はFAILED_UNRESOLVEDのまま。成功時は独立postcheck後にB token保持。terminal以後の再mutation、無認可rollbackを禁止 |

旧JIT validatorは暫定JIT専用として分離したままです。metadata plannerのrequired gatesも、B正常時のactive/scope/expiry readback、失敗時revoke、rotation時旧ID不在へ修正しました。

transportは暗黙の`fetch`/env/Wrangler loginを使いません。credential callbackはsecretをprocess memory内だけへ渡すhost-owned境界です。import/constructionだけでは通信もmutationも起こりません。factoryへ渡すreview済みselector/独立authorityはServerの採用済み・照合済みsourceから取得する必要があり、workflow inputの任意JSONや人間が付けた`true`で置き換えません。mockのresource mapは**明示的な架空fixture**で、本番selectorを推測したものではありません。

## 公式契約と権限の具体依存

- [Token Details](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/get/) は`Account API Tokens Read/Write`、[Delete Token](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/delete/)はWriteを必要とします。[List Tokens](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/list/)にはlist-self callerでは全tokenを返さない注意があります。サイトEditorへこれらを追加しません。
- [Worker settings](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/)、[active deployment](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/)、[Worker identity](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/)、[version](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/)を個別照合します。[route list](https://developers.cloudflare.com/api/resources/workers/subresources/routes/methods/list/)にはWorkers Routes Read/Writeが必要で、独立audit authorityで全account zoneの可視性をreview/readbackします。
- emergency containmentだけが[公式subdomain更新](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/create/)へ`enabled=false, previews_enabled=false`を送ります。通常のsuppression writerはSite configのまま。[Version URL仕様](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)とpinned Wrangler4.136.1の実装を照合しました。
- GitHubの[main保護GET](https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection)はAdministration(read)、[approval history](https://docs.github.com/en/rest/actions/workflow-runs#get-the-review-history-for-a-workflow-run)はActions(read)。read-only job tokenへadmin権限を暗黙に足しません。独立operatorの既存接続・公式UI readback等の実証が必要です。

## コードを止めなかった部分と残るlive依存

認証HTTP、raw応答のprojection、policy/provider/approval照合、独立safety mutationの限定adapter、watchdog controllerは実装しmock/negative testを実行済みです。token未発行はこれらのコード実装を妨げません。

残るものは具体的に次のとおりです。

1. Server側B採用、live permission IDs/個別Worker resource map/独立read権限と全inventory scopeの確認。独立authorityはoperationごとの一時operator credentialを想定し、初回確認は直前発行・24h以内expiryを要求。正式site長期tokenとは別です。恒久admin/issuer credentialを追加しません。新しい一時credentialの発行もまだ認可・実行していません。
2. deploy jobから独立したoperator hostでcontrollerを起動し、既存GitHub read接続と独立audit/revoke/containment sessionへ安全に結線する運用採用。job内`finally`や同じjobのprocessを独立と呼びません。controller自身のhostが失われる場合は別operator復旧が必要で、mockが物理的可用性を保証するわけではありません。新しいservice/access/networkを勝手に作りません。
3. 既存Production PowerShell consumerを実行するprotected runner bootstrap、verified stagingのhome hash/公開markerとpinned Wrangler実行receiptをadapterへ結線。任意shell callbackを本番deploy許可と扱わず、再build/alternate configを禁止して実証。現production templateはsecretを読み出さず停止します。
4. 認可済みの非production targetでactual API shape・403/failure・job cancellation・timeout・independent revoke/containment・取得範囲・receiptのlive試験。mockで形を捏造して本番受け入れを通しません。
5. main上の非配布Environment承認試験、運用成立直前のsite token発行/保管、最後に別reviewのproduction enable/operationとlive acceptance。

1〜5には追加の具体権限・接続・操作承認が必要です。adapterが既存のlive契約に合うかを確認せずtokenだけを先行発行しません。今回のmain/空Environment設定は[適用記録](production-protection-acceptance-20261006.md)で別に確認しています。実配布・live acceptance・JIT撤去の完了とは扱いません。
