---
status: canonical
owner: architecture
last_verified: 2026-09-29
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
live_provider_verification: first production operation pre/post PASS 2026-09-29; future-operation fresh preflight REQUIRED
mutation_permitted_revision: NOT ESTABLISHED (no standing mutation authority)
decision_b_site_handoff: MERGED / PR #56
first_production_operation_status: ACCEPTED / COMPLETE 2026-09-29
accepted_production_site_revision: b9554ed43d5b743dfe99efc80ad5474535ad72cd
accepted_production_artifact_id: 10979514770
accepted_production_artifact_digest: sha256:409169600d7124fe54f927e4145a0a95d3270d5bfb79c267dbe479b251f306ca
accepted_production_deployment: 27ff84b7-e591-4607-a0e6-33439facb75f
accepted_production_version: 52d1f165-e6a7-47b0-9965-30286fbaa2c0
accepted_production_traffic_percent: 100
accepted_live_workers_dev: false
accepted_live_preview_urls: false
accepted_live_bindings: 0
accepted_live_r2_bindings: 0
future_production_deploy_authorized: false
```

[PR #60](https://github.com/Xpotato1024/Xpotato-Server/pull/60)はDecision B / ADR-0027をmergeし、[PR #61](https://github.com/Xpotato1024/Xpotato-Server/pull/61)がpost-merge lifecycle表記を同期した。[PR #63](https://github.com/Xpotato1024/Xpotato-Server/pull/63)はADR-0029をAccepted / Mergedとしてcross-repository exact bindingをSite→Serverの一方向に固定し、上記revisionがcurrent accepted Server authorityとなる。ADR-0026のprovider architecture / desired basisとaccepted source、ADR-0027のtemporary JIT semanticsは維持する。旧current counterpart `3da04ef09bd1f5b7bc6d9a1549fb08070671a672`（PR #57 merge）はhistorical predecessorであり、現在のhandoff authorityではない。Branch headやunmerged PR headをauthorityにしない。

[ADR-0026](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0026-website-cloudflare-phase9-candidate.md)、[acceptance record](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0026-acceptance-2026-09-22.md)、[ADR-0027](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0027-website-workstation-jit-deployment-exception.md)、[ADR-0029](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/decisions/ADR-0029-website-cross-repository-binding-direction.md)、[desired](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/inventory/desired/cloudflare.yaml#L24)、[architecture](https://github.com/Xpotato1024/Xpotato-Server/blob/c54a06ee377cae365af623b598ed852c4b577e1f/docs/architecture/website-cloudflare.md)を同じexact revisionで読む。

Historical counterpart `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d`は過去audit/freezeのevidenceのみ。Current counterpartではない。Server ADR-0026とSite external-AI disclosure ADR-0026は別repositoryの別decisionである。

## Site release artifact binding

Site ADR-0033のproducerは、このdocumentのexact Server authority SHAをrelease recordへ固定します。現行pinは`c54a06ee377cae365af623b598ed852c4b577e1f`で、Site producer/consumerの変更はServer counterpartを再pinせず、Server `main`の無関係な前進もbindingを置き換えません。Site release packageは[`build-artifact-pipeline.md`](../operations/build-artifact-pipeline.md)のartifact ID、API digest、source/run/attempt規則に従います。

同一source/policyにbindした検証証拠は再利用できます。provider state、credential、authorization、deployment preimageなどlive evidenceは、別途明示認可されたmutationの直前に再確認します。artifact identityの検証はprovider現況の検証やmutation authorizationの代わりになりません。

## Ownership

Siteはcontent/application semantics、Worker artifact、単一validated `apps/site/wrangler.jsonc`、application path redirects、provider-neutral media source/public/protection contracts、object identity/hash/cache/receiptとpublication gatesを所有する。

Serverはaccount/zone/DNS facts、Worker custom-domain binding、provider-level query rules、actual A/B/C resource/config、credential/trust、provider adapterとrestore/drift/read-backを所有する。Account/bucket/provider locatorはSiteへ第二SoTとしてコピーしない。

Endpoint suppressionのdeploy input ownerはSiteだけ。`workers_dev=false` / `preview_urls=false`をliteral false必須としてvalidateし、missing/true/wrong type/unknown fieldを拒否する。通常deploy / rollbackで別config・environment・CLI overrideを許可しない。Serverのtarget=falseはhandoff requirementであり競合する第二writerではない。詳細は`../operations/deployment-boundary.md`。

## Decision B — temporary deployment bridge

通常production deployment ownerは引き続きGitHub Actionsだが、現行`deploy-site.yml`は`if: ${{ false }}`でBLOCKED。Decision Bはworkflow unblockでもdeploy authorizationでもない。正式pathが未成立・未検証の間だけ、operatorがoperation単位で明示認可した場合にoperator-controlled workstation JIT経路を使える。これは**temporary bridge**であり恒久fallback / 常設manual deploy pathではない。

Server ADR-0027がcredential/trustの正本。Cloudflare account-owned API tokenは`Individual Workers → xpotato-site → Editor`のallow policy 1件・追加policy/permission group 0に限定し、発行後deploy前にprovider policyのexact selectorをread-backする。Operation直前に発行し、approved artifactを使ったdeployとprovider/data-plane read-back後に同一token IDを即revokeし、receiptとinventory/detailをread-backする。途中中止・失敗時もrevokeする。Persistent production deploy credentialはGitHub secrets、repository、`.env`、credential files、長期shell environment、SOPS、CP、Offline Kitに置かない。旧広域credentialは2026-09-23に**REVOKED**であり再利用しない。Stale Workers Builds registrationのcleanupはServer所有の別provider mutation。

Workstation自体をartifact authorityにしない。Future operationはoperatorが認可したexact Site revision、clean tree、pinned dependencies、required CI/validation PASS、exact build artifact、単一の`apps/site/wrangler.jsonc`、approved/pinned Wranglerを固定し、config/environment/CLI overrideとR2 bindingsを拒否する。Mutation前のactive deployment/version/traffic、bindings、routes、custom domains、endpoint flags、settings、`xpotato.net` health、rollback inputをpreimageとして固定し、material driftならSTOP。Deploy前後のR2 bindingsは**0**必須。Individual Worker Editorのbinding導入可能性はaccepted residual riskであり、direct R2 API denyをA/C hard isolationの証明としない。

最初のauthorized deployは2026-09-29に完了し、Site-owned configがworkers.dev / Preview URLsをfalseへ適用しました。Post-deployでdeployment/version、bindings 0、endpoint false/false、domain/routes、HTTP health、alternate endpoint 404をread-backし、production acceptanceはPASS。Containment capabilityはdeploy前に確認済みで、suppression成功のためcontainment POSTは不要でした。今後もServer/API/Dashboardを通常のsecond writerにせず、future deployでは同じfailure containment contractを再適用します。

暫定例外の廃止条件は、(1) persistent credential禁止を満たすGitHub Actions正式production pathが別design/reviewでaccepted、(2) 安全に有効化、(3) 少なくとも1回の実運用でartifact validation・provider read-back・endpoint suppression・credential lifecycleを含むacceptanceがPASS、(4) その後の別reviewed changeでworkstation JIT例外を廃止、の全て。2026-09-29のfirst production operationにより(3)は満たした。(1)(2)(4)は未完了のためDecision Bはtemporary bridgeとして継続する。

## OPEN activation gates

Accepted architecture / desired semanticsはresource existenceやfuture operationのstanding authorizationを意味しない。2026-09-29のfirst production Worker operationではlive preflight、deploy、post-deploy read-back、endpoint suppression、credential revokeまでPASSした。A/C resource realization、provider query redirects、media publication/protection等は別scopeでOPEN / PENDING。Future operationではfresh preflightを再実施する。

Worker deploy credential → R2 binding hard isolationは**証明していない**。Decision Bはそのresidual riskを受け入れ、deploy前後のWorker R2 bindings=0を必須にする。Unexpected bindingはvalidation/acceptance FAIL・operator review。Persistent deploy credential / workflow unblockはBLOCKED。

`persistentMutationAuthorized=false`、deploy workflow `if: ${{ false }}`、publication holdを維持する。Endpoint suppressionのlive適用とfirst production deployは2026-09-29にACCEPTED済み。Containment POSTは不要、media/redirect realizationとfinal cutoverはPENDING。One-time deployment authorizationは消費済みで、standing mutation-permitted revisionはNOT ESTABLISHED。

## Update / next boundary

Counterpart変更時はServer review/merge後のexact revisionとacceptance record/canonical desiredを確認し、Site handoffとaffected fresh cross-repo auditを更新する。ADR-0029に従いbindingはSite→Serverの一方向で、Site handoff merge後にServerへSite SHAを再pinしない。Mutable mainをCI runtimeで取得してauthorityを差し替えない。

2026-09-29のfirst authorized workstation JIT production deploymentはACCEPTED / COMPLETE。次工程はprovider query redirectsおよびA/C/B media/resource realizationを、それぞれ別のexplicit authorizationで進める。Future production deployも毎operationのfresh preflightとexplicit authorizationを要する。
