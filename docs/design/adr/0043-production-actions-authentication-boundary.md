---
status: mode-b-selected-github-settings-verified-live-pending
owner: operations
last_verified: 2026-10-06
---

# ADR 0043：期限付きサイト限定tokenによる正式GitHub Actions経路

## 判断の状態

2026-10-06、本人は比較案B（長期のサイト限定token保管）を明示選択しました。従来の恒久deploy credential禁止からの方針転換として記録します。方式選択は実credential発行・保管、GitHub保護設定、権限/network変更、workflow有効化、merge/deploy、JIT撤去の承認ではありません。

このSite ADRでは**Bを設計上の選択として採用し、credential・live配布は未承認**とします。main保護と空Environmentは本人の後続承認で適用し、[別GETで確認済み](../../operations/production-protection-acceptance-20261006.md)です。Server ADR0027の現行禁止は未変更です。[Server側変更案](production-actions-server-change-proposal.md)を別review/採用しcross-repo pinを更新するまで、現行authorityをこの提案で上書きしません。OIDC交換を推測して作らず、GitHub Environment保管の期限付き個別Worker tokenを使用する方式を設計します。

## 公式仕様で確認したこと

2026-10-06時点で次の一次資料を確認しました。

1. [Cloudflare Workers / GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)は、非対話CIのWrangler認証にAPI tokenを要求し、CI Secretsを使う例を示します。[公式wrangler-action](https://github.com/cloudflare/wrangler-action)もapiToken入力です。この通常例の恒久credential保存は現行Server ADR0027に合いません。
2. [GitHub OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)は、相手providerのOIDC trustとtoken交換機能を前提にします。GitHubがJWTを発行できることだけではCloudflare Workers API権限を得られません。確認したCloudflare公式資料で、その直接交換方式を確認できていません。未確認は全製品・将来機能についての不存在証明ではありません。
3. [Cloudflare account token発行API](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/create/)はBearer認証と`Account API Tokens Write`を必要とし、有効期限を指定できます。短期の子tokenだけにしても、無人で発行する恒久issuerの権限・秘密が消えるわけではありません。現行ADR0027は短いTTLのための恒久minting issuer導入も禁じます。
4. [Account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)はDashboardでの発行・期限指定を提供します。これをoperationごとの対面供給へ使う案は考えられますが、無人運用にはなりません。

5. [Cloudflare OAuth client仕様](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/)は第三者clientにAuthorization Codeだけを提供し、Client Credentials・Device Authorization・その他grant typeを非対応と明記します。CLI向けPKCE（S256、token endpoint認証`none`）ならclient secretは不要ですが、対話的な認可が必要です。これはGitHub OIDC JWTの直接交換ではありません。scope名がAPI token permission名へ対応することは確認しましたが、Individual Workersのexact resource selectorとの同等性は未確認です。

PKCEをA案の別候補として調査できます。ただし新しいprivate client登録自体が権限・trust変更であり、今回は登録しません。[OAuth連携仕様](https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/)はrevoke endpointを公開し、[認可管理仕様](https://developers.cloudflare.com/fundamentals/oauth/authorizing-an-application/)はDashboardからの失効を説明します。しかし今回確認した資料だけではoperation期限、refresh credentialを保存しない終了条件、exact Worker scope、失効後の同一認可のreadbackと独立containmentを確立できません。既存account-owned tokenのsame-ID revoke検査をOAuthにそのまま適用しません。別adapterとServer側の採用判断が必要です。

OAuthのrefresh credential、Accessのservice token、R2の一時S3 credential、別の一時Cloudflare accountは、既存production Workerへの恒久資格情報なしの正式認証として確認したものではありません。名称が短期/OIDCであるだけで代用しません。

## 比較の履歴とBの選択

「完全無人」「Cloudflareに対する恒久credential/issuerなし」「毎回の対面token供給なし」をすべて満たす実装は、確認できた公式方式からは確立できません。本人はこの制約のうち恒久deploy credential禁止を変更してBを選びました。以下は判断時の比較の履歴です。

| 案 | 利点 | 必要な判断・残る作業 |
| --- | --- | --- |
| A：Actions所有の隔離runnerへoperation単位で対面供給 | Cloudflareの恒久deploy token/issuerを置かず、実際の配布をActions jobへ集約できる候補 | 手動発行は残る。隔離・ephemeral runner、非表示のmemory-only intake、独立containmentとsame-ID revokeを設計・実証する必要。GitHub runnerの登録credentialは別trustであり「すべての恒久accessが消える」とは言えない。public PRがそのrunnerを使用できない制限も必要。既存workstation JITを名前だけ変えたものを正式完了と呼ばない |
| B：無人運用を優先し、限定deploy credentialまたはissuerを許す | 公式API/token方式で自動化しやすい | 現行恒久credential禁止の変更が必要。Serverでexact permission・保管・rotation/revoke・R2 binding residual riskを別ADR/監査/本人採用。GitHub Secretsへ置く案と外部brokerへ置く案は保管場所の違いで、恒久trustの消滅ではない |
| C：公式の適合federation機能を待つ／providerへ確認 | 現行制約を保てる | 実行可能な正式配布は未完成のまま。native exchangeの公開仕様と実証が得られるまでworkflow停止を維持 |

Bの本人選択を記録し、認証に依存しないreview/検査とB用の保管・更新・保護contractを実装します。実設定前の承認はまだなく、adapter/supervisorのコードとmock検証を進め、live authority・physical host・配布へは接続しません。

A案の隔離runnerは[GitHubのephemeral runner仕様](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)を参考にする設計候補です。1job後の登録解除だけでhostの秘密消去・隔離・対面handoffが保証されるわけではありません。runner登録用のGitHub権限、public repositoryのfork/PRからの利用防止、runner logへの秘密混入防止、job停止後のrevoke supervisorを別reviewする必要があります。今回runnerを登録・起動していません。

## 今回の実装

- 本番workflowは3つのjobともliteral `if: false`。非秘密のexact run/attempt/artifact/SHA/digestだけを入力とするrelease-review templateを追加。Cloudflare credential、`id-token: write`、秘密入力、Wrangler deploy stepはありません。
- `deployment-plan.mjs`はGitHub GETでexact successful main producerとartifact外部identity/期限を確認し、`BLOCKED_CREDENTIAL_AND_LIVE_ACCEPTANCE`を出力。API digest確認だけをarchive検証と呼ばず、既存PowerShell Production consumer/handoffを引き続き必要とします。再build・staging編集を行いません。
- `deployment-policy.mjs`は将来adapterから受ける**非秘密のnormalized evidence**の整合性検査です。provider pagination完了、deployment/version/100% traffic、bindings/routes=0、既存hostname、workers.dev/actual version previewの404とcontent不在、public byte一致、freshness、token scope/期限、独立containment、single deploy、post-readback、same-ID revoke/inventory/detailを検査します。
- 合成evidenceがすべて通っても結果は`EVIDENCE_CONSISTENT / acceptance=false`。任意JSONが実際のprovider応答や人間承認であることは証明しません。raw API adapter、selector照合、独立revoke/containmentとsupervisorは[コード/mock検証済み](../../operations/production-adapter-verification.md)です。live authority・本人承認証跡・physical host・production bootstrapへの接続とlive実証は残ります。
- 別のcredential-free CIでこれらの正常/失敗fixtureを検査。frontend PR65から分離し、既存CIのbuild-once graphと公開保留を変更しません。
- B専用`deployment-persistent-policy.mjs`はJITとは別に期限/更新、main/Environmentの非秘密保護情報、同一artifact handoff、provider前後、正常時active readback、失敗時emergency revoke、rotation時の新ID/Secret更新/旧ID不在を検査します。Bの合成成功も`acceptance=false`です。

## 有効化と暫定経路の撤去

次の順序を維持します。

1. Bの本人選択済み。Server所有のcredential/trust方式の別design・review・採用。
2. 選んだ方式のactual adapterと認証・containment・revoke能力を実装・非productionで検証。必要なrunner/access/network変更も個別認可。
3. 正式workflowの安全な有効化を別reviewで認可。成功したmain artifactをProduction consumerで取得し、operation単位の承認・fresh preimage後に実行。
4. 最低1回、正式Actions経路でartifact/provider/endpoint/credential lifecycleを含むlive acceptance PASS。
5. その後、別reviewed changeでworkstation JIT例外を撤去。今回の提案PR・merge・検査成功をこの条件の達成と扱わない。

Serverの禁止を変更する採用が必要です。publication hold、R2/DNS/media/redirect別gate、no alternate config、preview/workers.dev=false、bindings=0は維持します。旧credentialや古いpreflightの流用、許可のないrollback、workflowの解除は行いません。


## Bの具体案と承認待ち設定

- GitHub Environment `site-production` のみに `CLOUDFLARE_SITE_API_TOKEN` を保管。account-owned、allow1件、Individual Workers → xpotato-site → Editor、追加0。最大90日、60日で更新必須、残存7日未満は配布禁止。正常時はactive/scope/期限のreadback、失敗・unknown・漏洩時は独立sessionによるsame-ID revoke/containmentを必要とします。
- 2026-10-06の設定前GET監査：public/User owner、main protected=false、rulesets=[]、environments=0。後続承認でmain/空Environmentを適用し、別GETで確認済み。Secrets値は取得していません。これは設定前の記録で、将来のlive保護readbackに代用しません。
- main：PR経由必須、必要CI `result` / `offline-policy` をGitHub Actions App15368へ限定、up-to-date必須、adminへも適用、force push/deletion禁止、会話解決必須。他者のPR approvalは0、Code Owner/last-push approvalは必須にしません。単独所有者に他者approvalを必須化して永久にmerge不能にしないためです。
- Environment：selected **branch mainのみ**、tagsなし、required reviewer `Xpotato1024`、prevent_self_review=false、admin bypass不可。本人がdispatchして本人が明示承認できる構成で、二者承認とは呼びません。protected-branches-onlyは、保護未設定時に全branchを許すため使いません。
- 公式actionは2026-10-06の公式repository v4 refをGET照合したfull commit SHAへ固定。checkout credential永続化なし。PR CIはhosted/read権限のみでEnvironment/Secretsを使わず、`pull_request_target`は追加しません。offline-policyは全PRで必ず走らせ、path filterによる必須checkの永久pendingを避けます。
- release-reviewとproductionを別jobにします。将来secretを使うのはEnvironment承認後のproductionだけ。承認待ちの間にartifact期限・source/保護・provider状態が変わり得るので、production直前に同一artifactを再取得してProduction consumerで再検証し、fresh gateを通す必要があります。今回全jobはliteral false、secret参照・実deployは未接続です。
- [設定案JSON](../../operations/production-settings-proposal.json) はtoken/enableの未承認部分を含むレビュー用です。main/空Environmentだけ後続承認で適用し、Secret/Variableは0件です。[Server側の変更案](production-actions-server-change-proposal.md)は長期tokenのR2 binding residual risk、更新/漏洩時の失効、JIT撤去条件を規定します。

GitHubの[Environment仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)と[設定手順](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)は、本人が開始したrunのself-review禁止とsecret公開前の承認、public repoでの保護を説明します。[main保護仕様](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)に基づく案です。本人のadmin資格情報が侵害された場合の設定改変までhard isolationしません。
