---
status: canonical
owner: architecture
last_verified: 2026-09-22
canonical_for:
  - cross-repository infrastructure design binding
  - website Cloudflare ownership handoff
---

# Infrastructure Handoff

## Exact merged counterpart

Siteが所有しないprovider designは次のimmutable Server revisionへbindする。Site Phase 9B changeはREADY FOR REVIEW / pending mergeであり、provider activationではない。

```yaml
repository: Xpotato1024/Xpotato-Server
revision: 3da04ef09bd1f5b7bc6d9a1549fb08070671a672
merge_pr: 57
merge_commit: 3da04ef09bd1f5b7bc6d9a1549fb08070671a672
accepted_source: bcd401aa366ce59a041716e94d80426416bc1193
adr: docs/decisions/ADR-0026-website-cloudflare-phase9-candidate.md
adr_status: Accepted
acceptance_record: docs/decisions/ADR-0026-acceptance-2026-09-22.md
canonical_desired: inventory/desired/cloudflare.yaml#website
architecture: docs/architecture/website-cloudflare.md
provider_mutation: BLOCKED / NOT AUTHORIZED
provider_mutation_authorized: false
live_provider_verification: PENDING
mutation_permitted_revision: NOT ESTABLISHED
```

[PR #57](https://github.com/Xpotato1024/Xpotato-Server/pull/57)は2026-09-22にmainへmerged。開始時のServer current mainとmerge commitはともに上記revision。Accepted sourceはそのancestorで、同revisionのacceptance recordがsource SHAを指定する。Branch headやunmerged PR headをauthorityにしない。

[ADR-0026](https://github.com/Xpotato1024/Xpotato-Server/blob/3da04ef09bd1f5b7bc6d9a1549fb08070671a672/docs/decisions/ADR-0026-website-cloudflare-phase9-candidate.md)、[acceptance record](https://github.com/Xpotato1024/Xpotato-Server/blob/3da04ef09bd1f5b7bc6d9a1549fb08070671a672/docs/decisions/ADR-0026-acceptance-2026-09-22.md)、[desired](https://github.com/Xpotato1024/Xpotato-Server/blob/3da04ef09bd1f5b7bc6d9a1549fb08070671a672/inventory/desired/cloudflare.yaml#L24)、[architecture](https://github.com/Xpotato1024/Xpotato-Server/blob/3da04ef09bd1f5b7bc6d9a1549fb08070671a672/docs/architecture/website-cloudflare.md)を同じexact revisionで読む。

Historical counterpart `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d`は過去audit/freezeのevidenceのみ。Current counterpartではない。Server ADR-0026とSite external-AI disclosure ADR-0026は別repositoryの別decisionである。

## Ownership

Siteはcontent/application semantics、Worker artifact、単一validated `apps/site/wrangler.jsonc`、application path redirects、provider-neutral media source/public/protection contracts、object identity/hash/cache/receiptとpublication gatesを所有する。

Serverはaccount/zone/DNS facts、Worker custom-domain binding、provider-level query rules、actual A/B/C resource/config、credential/trust、provider adapterとrestore/drift/read-backを所有する。Account/bucket/provider locatorはSiteへ第二SoTとしてコピーしない。

Endpoint suppressionのdeploy input ownerはSiteだけ。`workers_dev=false` / `preview_urls=false`をliteral false必須としてvalidateし、missing/true/wrong type/unknown fieldを拒否する。通常deploy / rollbackで別config・environment・CLI overrideを許可しない。Serverのtarget=falseはhandoff requirementであり競合する第二writerではない。詳細は`../operations/deployment-boundary.md`。

## OPEN activation gates

Accepted architecture / desired semanticsはresource existence、live verification、mutation/deploy/cutover authorizationを意味しない。Resource existence、bucket collision、domain ownership、DNS/Worker/rules/lock state、credential scopeはUNKNOWN / PENDING、今回provider read/mutation/read-backはNOT RUN。

Worker deploy credential → R2 binding isolationは**OPEN**。Accepted baselineはstatic assets only / Worker R2 bindings空。Unexpected bindingはvalidation FAIL・別reviewを要するが、これをcredential-level isolationの証明にしない。Persistent deploy credential / workflow unblockはBLOCKED。

`persistentMutationAuthorized=false`、deploy workflow `if: ${{ false }}`、publication holdを維持する。Media realization/read-back/recovery、endpoint failure containment、production deploy/cutoverは別gate。Mutation-permitted revisionはNOT ESTABLISHED。

## Update / next boundary

Counterpart変更時はServer review/merge後のexact revisionとacceptance record/canonical desiredを確認し、Site handoffとaffected fresh cross-repo auditを更新する。Mutable mainをCI runtimeで取得してauthorityを差し替えない。

Site PR merge / fresh cross-repo gate完了後も自動provider applyは禁止。次工程は別途**Phase 9 live provider preflight / collision・ownership・capability verification**。結果を人間へ提示し、resource別normalized diff / rollback preimage / recovery publication等の必須条件とexplicit resource realization authorizationを揃えてからmutationへ進む。
