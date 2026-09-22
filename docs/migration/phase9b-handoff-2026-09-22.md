---
status: proposed
owner: migration
last_verified: 2026-09-22
canonical_for:
  - Phase 9B accepted provider handoff readiness candidate
---

# Phase 9B accepted provider handoff

## 状態 / exact inputs

**READY FOR REVIEW / pending merge**。これはSite handoffとendpoint suppressionのcandidateであり、Phase 9全体のCLOSED、provider activation、production deployment/cutoverの完了ではない。

| Input | Exact identity |
|---|---|
| Site base main（Phase 8 PR #54 merged） | `4876b23e529563b17b3b8fbb9c520ad4e347eafb` |
| Server current main / PR #57 merge commit | `3da04ef09bd1f5b7bc6d9a1549fb08070671a672` |
| Server accepted source | `bcd401aa366ce59a041716e94d80426416bc1193` |
| ADR | Server ADR-0026 **Accepted** |
| Current desired | Server `inventory/desired/cloudflare.yaml#website` |
| Architecture / acceptance | Server `docs/architecture/website-cloudflare.md` / `docs/decisions/ADR-0026-acceptance-2026-09-22.md` |

Server accepted sourceはmerged counterpartのancestorであり、acceptance recordのaccepted_candidateと一致する。Site candidate exact SHA、fresh read-only audit verdictとHosted CI URLはPR本文で固定する。Commitへ自身のSHAを埋め込まない。Current handoff authorityは`../architecture/infrastructure-handoff.md`だけであり、unmerged branch headやhistorical counterpartを使わない。

## Endpoint suppression / deploy input ownership

既存`apps/site/wrangler.jsonc`だけへ`workers_dev: false`、`preview_urls: false`を追加。Validatorのallowlistをこの2 fieldsだけ拡張し、両方をliteral false必須にする。Missing / true / wrong type / unknown field / environment override / R2 binding（空配列含む）を拒否し、asset directory / 404 profile等の既存制約を維持する。

Siteが両flagsの唯一のdeploy input owner。Server desiredはcross-repository requirementであって第二writerではない。Repository validatorはexact configを読み、workflowの`VNEXT_WRANGLER_CONFIG`も同じpathを固定する。現行production deploy invocationは存在しない。Legacy root configはmigration evidenceのみ。通常deploy / rollbackでalternate config、environment-specific override、CLI overrideを使うproduction pathは禁止し、将来の追加は別authorization/reviewで扱う。

## Cross-repository invariants

| Contract | 照合対象 / 固定条件 |
|---|---|
| Worker / hostname | Wrangler name `xpotato-site`、Site canonical origin `https://xpotato.net/`とServer service/hostname一致 |
| Endpoint suppression | Server workers_dev_target_enabled / preview_urls_target_enabled=false、Site両flags=false |
| Query redirects | Phase 8 manifestの下記3 requirementsとServer desired rulesのみ。Requirement ID / ContentId / target / permanent 301 / preserve query=false / exact raw host・path・query equality |
| Application redirects | Site registryとPhase 8 manifestのexactly 6件。Serverの3 query rulesへpath redirectをduplicateしない |
| A canonical source | private privacy-normalized lossless canonical master、`private_canonical_media_v1`、raw camera original禁止、content-addressed、automatic expiryなし |
| B public delivery | approved master + required variants、content-addressed immutable keys、exact MIME / immutable cache metadata |
| C protected exact bytes | separate private exact public object set、`cloudflare_protected_copy_v1`、opaque ref、indefinite protection / expiryなし、public publisherにC accessなし |
| Safety | `persistentMutationAuthorized=false`、Server persistent mutation/activation/provider_apply=false、deploy hard block、publication hold維持 |

| Requirement | ContentId | Target |
|---|---|---|
| wordpress-34 (`/?p=34`) | bca48f98-c89a-457f-84d8-168f941fe469 | https://xpotato.net/tools/prime-factorizer/ |
| wordpress-693 (`/?p=693`) | 94147d1b-338e-4e03-aa25-595558a513dd | https://xpotato.net/blog/vibration-robot/ |
| wordpress-811 (`/?p=811`) | f202daa7-cb5c-4dd3-8b17-7bb6b1feefae | https://xpotato.net/blog/2025-10-06/ |

Query targetは301固定、queryを保持しない。Serverはraw path `/` / raw query全体 `p=N` / hostのexact equalityを要求する。追加query、duplicate p、encoded/大文字/leading zero、別host/pathを許す拡張ではない。Wire normalization / live provider挙動は未検証。2 Blog targetsはhold中でありrule activationは不可。

照合は上記exact Server revisionから取得したpayloadに対して行う。CI runtimeでmutable mainを取得する依存やprovider locatorのコピーを追加しない。Bucket/account/provider locatorの唯一のSoTはServerであり、Site contractはclass/hash/profile/opaque refを使う。

## 検証 / fresh audit gate

`npm ci`、focused deployment-config tests（31 tests）、`npm run ci`、base→candidate `git diff --check`を実施する。Local結果とHosted Linux結果を区別し、Windows byte差や未実行をPASSとしない。Full vNext CIとrelevant readiness gatesは**exact headのHosted Linux SUCCESSをmerge gate**とする。Focused testsは既存full CIのtest suiteで実行される。

Candidate exact SHA固定後、別instanceがSite candidateとServer exact counterpartをfresh read-only auditしP0/P1/P2を記録する。Audit中の修正は禁止。FAILなら別remediation → new exact SHA → fresh audit。Audit/CIの完了結果はPRにexact head付きで記録する。

## OPEN gates / next authorization boundary

- Worker deploy credential → R2 binding isolation: **OPEN**。Static-assets-only / no R2 bindingsのvalidationはcredential-level isolation証明ではない。Binding追加は別review、persistent deploy credential / workflow unblockはBLOCKED。
- Provider activation: **BLOCKED / NOT AUTHORIZED**。Provider mutation=false、mutation/read-back/credential creationは**NOT RUN**。
- Live provider verification: **PENDING**。Resource existence、bucket collision、domain ownership、DNS、Worker、redirect rules、Bucket Lock、credential scopeは**UNKNOWN**。今回Cloudflare account readは行わない。
- Media realization / persistence / receipts / representative protected restore: **PENDING**。
- Deploy workflow: `if: ${{ false }}`維持。Secret/environment credential/API token/deploy step追加なし、deployment job実行なし。
- Publication hold: **維持**。Production deploy/cutover: **BLOCKED**。
- Mutation-permitted revision: **NOT ESTABLISHED**。Accepted/merged designと別。

このPRのmergeとfresh cross-repo gate完了から自動provider applyへ進まない。次は別途**Phase 9 live provider preflight / collision・ownership・capability verification**。結果を人間へ提示し、resource別normalized diff・rollback preimage・recovery publication等の必須条件を満たし、resource realizationの**explicit authorization**を受けてからmutationへ進む。
