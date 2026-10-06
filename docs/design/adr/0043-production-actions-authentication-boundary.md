---
status: proposed
owner: operations
last_verified: 2026-10-06
---

# ADR 0043：正式GitHub Actions経路と未解決の認証境界

## 判断の状態

2026-10-06、ユーザーは暫定workstation JITによる今回の公開より先に、恒久deploy credentialを置かない正式経路の設計・実装を進める方針を承認しました。これは認証方式の採用、token発行、runner登録、権限・network変更、workflow有効化、merge/deploy、JIT例外撤去の承認ではありません。

本ADRは**未採用の設計候補**です。既存のServer ADR0027とSite infrastructure-handoffを変更・昇格しません。正式経路の認証を未選定のまま停止し、実装できる成果物・非秘密の検査を先行します。OIDC交換endpointを推測して作りません。

## 公式仕様で確認したこと

2026-10-06時点で次の一次資料を確認しました。

1. [Cloudflare Workers / GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)は、非対話CIのWrangler認証にAPI tokenを要求し、CI Secretsを使う例を示します。[公式wrangler-action](https://github.com/cloudflare/wrangler-action)もapiToken入力です。この通常例の恒久credential保存は現行Server ADR0027に合いません。
2. [GitHub OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)は、相手providerのOIDC trustとtoken交換機能を前提にします。GitHubがJWTを発行できることだけではCloudflare Workers API権限を得られません。確認したCloudflare公式資料で、その直接交換方式を確認できていません。未確認は全製品・将来機能についての不存在証明ではありません。
3. [Cloudflare account token発行API](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/create/)はBearer認証と`Account API Tokens Write`を必要とし、有効期限を指定できます。短期の子tokenだけにしても、無人で発行する恒久issuerの権限・秘密が消えるわけではありません。現行ADR0027は短いTTLのための恒久minting issuer導入も禁じます。
4. [Account API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)はDashboardでの発行・期限指定を提供します。これをoperationごとの対面供給へ使う案は考えられますが、無人運用にはなりません。

5. [Cloudflare OAuth client仕様](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/)は第三者clientにAuthorization Codeだけを提供し、Client Credentials・Device Authorization・その他grant typeを非対応と明記します。CLI向けPKCE（S256、token endpoint認証`none`）ならclient secretは不要ですが、対話的な認可が必要です。これはGitHub OIDC JWTの直接交換ではありません。scope名がAPI token permission名へ対応することは確認しましたが、Individual Workersのexact resource selectorとの同等性は未確認です。

PKCEをA案の別候補として調査できます。ただし新しいprivate client登録自体が権限・trust変更であり、今回は登録しません。[OAuth連携仕様](https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/)はrevoke endpointを公開し、[認可管理仕様](https://developers.cloudflare.com/fundamentals/oauth/authorizing-an-application/)はDashboardからの失効を説明します。しかし今回確認した資料だけではoperation期限、refresh credentialを保存しない終了条件、exact Worker scope、失効後の同一認可のreadbackと独立containmentを確立できません。既存account-owned tokenのsame-ID revoke検査をOAuthにそのまま適用しません。別adapterとServer側の採用判断が必要です。

OAuthのrefresh credential、Accessのservice token、R2の一時S3 credential、別の一時Cloudflare accountは、既存production Workerへの恒久資格情報なしの正式認証として確認したものではありません。名称が短期/OIDCであるだけで代用しません。

## 両立しない要件と選択肢

「完全無人」「Cloudflareに対する恒久credential/issuerなし」「毎回の対面token供給なし」をすべて満たす実装は、確認できた公式方式からは確立できません。以下のいずれかを明示的に選ぶ必要があります。

| 案 | 利点 | 必要な判断・残る作業 |
| --- | --- | --- |
| A：Actions所有の隔離runnerへoperation単位で対面供給 | Cloudflareの恒久deploy token/issuerを置かず、実際の配布をActions jobへ集約できる候補 | 手動発行は残る。隔離・ephemeral runner、非表示のmemory-only intake、独立containmentとsame-ID revokeを設計・実証する必要。GitHub runnerの登録credentialは別trustであり「すべての恒久accessが消える」とは言えない。public PRがそのrunnerを使用できない制限も必要。既存workstation JITを名前だけ変えたものを正式完了と呼ばない |
| B：無人運用を優先し、限定deploy credentialまたはissuerを許す | 公式API/token方式で自動化しやすい | 現行恒久credential禁止の変更が必要。Serverでexact permission・保管・rotation/revoke・R2 binding residual riskを別ADR/監査/本人採用。GitHub Secretsへ置く案と外部brokerへ置く案は保管場所の違いで、恒久trustの消滅ではない |
| C：公式の適合federation機能を待つ／providerへ確認 | 現行制約を保てる | 実行可能な正式配布は未完成のまま。native exchangeの公開仕様と実証が得られるまでworkflow停止を維持 |

今回はA/B/Cの採用を代行しません。別判断前の実装は認証に依存しないreview/検査に限り、実配布adapterを接続しません。

A案の隔離runnerは[GitHubのephemeral runner仕様](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)を参考にする設計候補です。1job後の登録解除だけでhostの秘密消去・隔離・対面handoffが保証されるわけではありません。runner登録用のGitHub権限、public repositoryのfork/PRからの利用防止、runner logへの秘密混入防止、job停止後のrevoke supervisorを別reviewする必要があります。今回runnerを登録・起動していません。

## 今回の実装

- 本番workflowは2つのjobともliteral `if: false`。非秘密のexact run/attempt/artifact/SHA/digestだけを入力とするrelease-review templateを追加。Cloudflare credential、`id-token: write`、秘密入力、Wrangler deploy stepはありません。
- `deployment-plan.mjs`はGitHub GETでexact successful main producerとartifact外部identity/期限を確認し、`BLOCKED_AUTH_DECISION`を出力。API digest確認だけをarchive検証と呼ばず、既存PowerShell Production consumer/handoffを引き続き必要とします。再build・staging編集を行いません。
- `deployment-policy.mjs`は将来adapterから受ける**非秘密のnormalized evidence**の整合性検査です。provider pagination完了、deployment/version/100% traffic、bindings/routes=0、既存hostname、workers.dev/actual version previewの404とcontent不在、public byte一致、freshness、token scope/期限、独立containment、single deploy、post-readback、same-ID revoke/inventory/detailを検査します。
- 合成evidenceがすべて通っても結果は`EVIDENCE_CONSISTENT / acceptance=false`。任意JSONが実際のprovider応答や人間承認であることは証明しません。認証済みAPI adapter、raw selectorとの照合、署名/信頼境界、人間承認、deploy/revoke/containmentの実行機構は未接続です。
- 別のcredential-free CIでこれらの正常/失敗fixtureを検査。frontend PR65から分離し、既存CIのbuild-once graphと公開保留を変更しません。

## 有効化と暫定経路の撤去

次の順序を維持します。

1. A/B/Cの本人選択、Server所有のcredential/trust方式の別design・review・採用。
2. 選んだ方式のactual adapterと認証・containment・revoke能力を実装・非productionで検証。必要なrunner/access/network変更も個別認可。
3. 正式workflowの安全な有効化を別reviewで認可。成功したmain artifactをProduction consumerで取得し、operation単位の承認・fresh preimage後に実行。
4. 最低1回、正式Actions経路でartifact/provider/endpoint/credential lifecycleを含むlive acceptance PASS。
5. その後、別reviewed changeでworkstation JIT例外を撤去。今回の提案PR・merge・検査成功をこの条件の達成と扱わない。

既存のpersistent credential禁止、publication hold、R2/DNS/media/redirect別gate、no alternate config、preview/workers.dev=false、bindings=0は維持します。旧credentialや古いpreflightの流用、許可のないrollback、workflowの解除は行いません。
