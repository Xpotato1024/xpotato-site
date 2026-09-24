---
status: canonical
owner: architecture
last_verified: 2026-09-24
canonical_for:
  - cross-repository infrastructure design binding
  - website Cloudflare ownership handoff
---

# Infrastructure Handoff

## Exact merged counterpart

Siteが所有しないprovider design / deployment-method / cross-repository binding directionは次のimmutable Server revisionへ一方向にbindする。Site Phase 9BはPR #55、Decision BのSite cross-repo handoffはPR #56でmerged済み。ServerはSiteのlatest SHAをcurrent counterpartとして再pinしない。Provider activationではない。

```yaml
repository: Xpotato1024/Xpotato-Server
revision: c54a06ee377cae365af623b598ed852c4b577e1f
merge_pr: 63
merge_commit: c54a06ee377cae365af623b598ed852c4b577e1f
decision_merge_pr: 60
lifecycle_sync_pr: 61
binding_direction_pr: 63
accepted_source: bcd401aa366ce59a041716e94d80426416bc1193
adr_provider: docs/decisions/ADR-0026-website-cloudflare-phase9-candidate.md
adr_deployment_exception: docs/decisions/ADR-0027-website-workstation-jit-deployment-exception.md
adr_cross_repository_binding: docs/decisions/ADR-0029-website-cross-repository-binding-direction.md
adr_provider_status: Accepted
adr_deployment_exception_status: Accepted / Merged
adr_cross_repository_binding_status: Accepted / Merged
acceptance_record: docs/decisions/ADR-0026-acceptance-2026-09-22.md
canonical_desired: inventory/desired/cloudflare.yaml#website
architecture: docs/architecture/website-cloudflare.md
normal_deploy_owner: GitHub Actions
normal_deploy_path: BLOCKED
temporary_exception: operator workstation JIT
exception_lifetime: temporary bridge
exception_retirement: after safe GitHub Actions production activation, successful real-operation acceptance, and separate reviewed removal
persistent_production_deploy_credential_authorized: false
provider_mutation: BLOCKED / NOT AUTHORIZED
provider_mutation_authorized: false
production_deploy_authorized: false
resource_realization_authorized: false
live_provider_verification: future-operation preflight PENDING
mutation_permitted_revision: NOT ESTABLISHED
decision_b_site_handoff: MERGED / PR #56
```

[PR #60](https://github.com/Xpotato1024/Xpotato-Server/pull/60)はDecision B / ADR-0027をmergeし、[PR #61](https://github.com/Xpotato1024/Xpotato-Server/pull/61)がpost-merge lifecycle表記を同期した。[PR #63](https://github.com/Xpotato1024/Xpotato-Server/pull/63)はADR-0029をAccepted / Mergedとしてcross-repository exact bindingをSite→Serverの一方向に固定し、上記revisionがcurrent accepted Server authorityとなる。ADR-0026のprovider architecture / desired basisとaccepted source、ADR-0027のtemporary JIT semanticsは維持する。旧current counterpart `3da04ef09bd1f5b7bc6d9a1549fb08070671a672`（PR #57 merge）はhistorical predecessorであり、現在のhandoff authorityではない。Branch headやunmerged PR headをauthorityにしない。

[ADR-0026](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0026-website-cloudflare-phase9-candidate.md)、[acceptance record](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0026-acceptance-2026-09-22.md)、[ADR-0027](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0027-website-workstation-jit-deployment-exception.md)、[ADR-0029](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0029-website-cross-repository-binding-direction.md)、[desired](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/inventory/desired/cloudflare.yaml#L24)、[architecture](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/architecture/website-cloudflare.md)を同じexact revisionで読む。

Historical counterpart `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d`は過去audit/freezeのevidenceのみ。Current counterpartではない。Server ADR-0026とSite external-AI disclosure ADR-0026は別repositoryの別decisionである。

## Ownership

Siteはcontent/application semantics、Worker artifact、単一validated `apps/site/wrangler.jsonc`、application path redirects、provider-neutral media source/public/protection contracts、object identity/hash/cache/receiptとpublication gatesを所有する。

Serverはaccount/zone/DNS facts、Worker custom-domain binding、provider-level query rules、actual A/B/C resource/config、credential/trust、provider adapterとrestore/drift/read-backを所有する。Account/bucket/provider locatorはSiteへ第二SoTとしてコピーしない。

Endpoint suppressionのdeploy input ownerはSiteだけ。`workers_dev=false` / `preview_urls=false`をliteral false必須としてvalidateし、missing/true/wrong type/unknown fieldを拒否する。通常deploy / rollbackで別config・environment・CLI overrideを許可しない。Serverのtarget=falseはhandoff requirementであり競合する第二writerではない。詳細は`../operations/deployment-boundary.md`。

## Decision B — temporary deployment bridge

通常production deployment ownerは引き続きGitHub Actionsだが、現行`deploy-site.yml`は`if: ${{ false }}`でBLOCKED。Decision Bはworkflow unblockでもdeploy authorizationでもない。正式pathが未成立・未検証の間だけ、operatorがoperation単位で明示認可した場合にoperator-controlled workstation JIT経路を使える。これは**temporary bridge**であり恒久fallback / 常設manual deploy pathではない。

Server ADR-0027がcredential/trustの正本。Cloudflare account-owned API tokenは`Individual Workers → xpotato-site → Editor`のallow policy 1件・追加policy/permission group 0に限定し、発行後deploy前にprovider policyのexact selectorをread-backする。Operation直前に発行し、approved artifactを使ったdeployとprovider/data-plane read-back後に同一token IDを即revokeし、receiptとinventory/detailをread-backする。途中中止・失敗時もrevokeする。Persistent production deploy credentialはGitHub secrets、repository、`.env`、credential files、長期shell environment、SOPS、CP、Offline Kitに置かない。旧広域credentialは2026-09-23に**REVOKED**であり再利用しない。Stale Workers Builds registrationのcleanupはServer所有の別provider mutation。

Workstation自体をartifact authorityにしない。Future operationはoperatorが認可したexact Site revision、clean tree、pinned dependencies、required CI/validation PASS、exact build artifact、単一の`apps/site/wrangler.jsonc`、approved/pinned Wranglerを固定し、config/environment/CLI overrideとR2 bindingsを拒否する。Mutation前のactive deployment/version/traffic、bindings、routes、custom domains、endpoint flags、settings、`xpotato.net` health、rollback inputをpreimageとして固定し、material driftならSTOP。Deploy前後のR2 bindingsは**0**必須。Individual Worker Editorのbinding導入可能性はaccepted residual riskであり、direct R2 API denyをA/C hard isolationの証明としない。

最初のauthorized deployではSite-owned configがworkers.dev / Preview URLsをfalseへ適用する通常writer。Server/API/Dashboardを通常のsecond writerにしない。開始前に別認可の一回性containment capabilityを確立し、post-deployにdeployment/version、bindings 0、endpoint false/false、domain/routes、HTTP health、alternate endpoint不在をread-backする。Suppression失敗/UNKNOWNならpublication advancementを止めdeploy tokenをrevokeし、別認可containmentで両endpointを無効化して再readする。いずれかUNKNOWN/FAILならproduction acceptance FAIL。今回はこれらのprovider操作を行わない。

暫定例外の廃止条件は、(1) persistent credential禁止を満たすGitHub Actions正式production pathが別design/reviewでaccepted、(2) 安全に有効化、(3) 少なくとも1回の実運用でartifact validation・provider read-back・endpoint suppression・credential lifecycleを含むacceptanceがPASS、(4) その後の別reviewed changeでworkstation JIT例外を廃止、の全て。Decision B cross-repo handoffはPR #56でmerged済みだが、provider activation / deploy authorizationとは別である。

## OPEN activation gates

Accepted architecture / desired semanticsはresource existence、future operation時のlive verification、mutation/deploy/cutover authorizationを意味しない。2026-09-22〜23の固定preflight/G3/revokeはhistorical snapshotで、A/B/C・rules等の未観測範囲とfuture preflightはOPEN / UNKNOWN。今回provider read/mutation/read-backはNOT RUN。

Worker deploy credential → R2 binding hard isolationは**証明していない**。Decision Bはそのresidual riskを受け入れ、deploy前後のWorker R2 bindings=0を必須にする。Unexpected bindingはvalidation/acceptance FAIL・operator review。Persistent deploy credential / workflow unblockはBLOCKED。

`persistentMutationAuthorized=false`、deploy workflow `if: ${{ false }}`、publication holdを維持する。Endpoint suppressionのlive適用、containment、media/redirect realization、production deploy/cutoverは別gateでNOT RUN。Mutation-permitted revisionはNOT ESTABLISHED。

## Update / next boundary

Counterpart変更時はServer review/merge後のexact revisionとacceptance record/canonical desiredを確認し、Site handoffとaffected fresh cross-repo auditを更新する。ADR-0029に従いbindingはSite→Serverの一方向で、Site handoff merge後にServerへSite SHAを再pinしない。Mutable mainをCI runtimeで取得してauthorityを差し替えない。

Site PR merge / fresh cross-repo gate完了後も自動provider apply/deployは禁止。次工程は別taskの**first authorized workstation JIT production deployment readiness**で、current live preflight、exact Site artifact、containment capability、operator explicit deployment authorizationを再確認する。Resource realizationはそれぞれ別のexplicit authorizationを要する。
