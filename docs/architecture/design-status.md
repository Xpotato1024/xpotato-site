---
status: canonical
owner: architecture
last_verified: 2026-08-29
canonical_for:
  - vNext design lifecycle
  - design freeze gate
  - implementation and migration activation gate
---

# vNext Design Status

## Current status

- Design: **FROZEN**
- Implementation: **IN PROGRESS — foundation + migration Phase 1 accepted/merged; Phase 4 content identity/content migration is next**
- Legacy migration/cutover: **BLOCKED**
- Cloudflare provider activation for vNext: **BLOCKED**
- Production Article Job external-provider activation: **BLOCKED until implementation gates pass**

The operator explicitly accepted Design Freeze on **2026-08-26** after Clean-room Audit #5。

Greenfield workspace/CI, contract, provider-neutral pipeline, validator, and representative static-site foundation revision `197fc85266b653f3ebd7262c20ed2eb9c366d9d5` passed a separate fresh read-only implementation audit (**PASS — P0=0 / P1=0 / P2=0**) and was merged through PR #41 by main merge commit `4a478c7fa3a02825930dbc9249557b850f14d2c5`。Post-merge GitHub-hosted vNext CI on that main revision passed。

Migration Phase 1 is now also accepted/merged。Phase 1A final closure revision `a4a600c2e6172cc88b0cdc8182541372cfbb608e` passed its fresh closure re-check (**PASS — P0=0 / P1=0 / P2=0**) and was merged through PR #42 by main merge commit `abc9bd3699626718b3c459ea68e0a8bfc3459ec2`。Phase 1B revision `293ae808c1827e6e4147a5775974d7ef112d622b` passed a fresh read-only Phase 1B audit (**PASS — P0=0 / P1=0 / P2=0**) and was merged through PR #43 by main merge commit `94c46c5f6f6663e4f16973d10f48a067f2f79c45`。Post-merge vNext CI on that main revision passed。Phase acceptance details are recorded in `../migration/phase1-acceptance-2026-08-29.md`。

The greenfield migration-plan Phases 2–3 foundation is already accepted/merged, so the next repository implementation work is **Phase 4 — Content identity / content migration**。Repository-only reviewed migration work may proceed under explicit tasks。This does **not** authorize production legacy cutover, old active implementation deletion, provider mutation, deployment, or production external-AI activation。

Freeze adoption authority:

- `../design/freeze-manifest-2026-08-26.md`
- audited design baseline: `f42e490c49bab795e6c15682611564ff0edd841c`
- Audit #5: **PASS — P0=0 / P1=0 / P2=0**

The audited design content is adopted byte-identically through the Freeze Manifest. Pre-Freeze `status: proposed` markers inside files from that audited baseline are retained as historical review metadata and do not override this lifecycle authority for the adopted baseline。

## Clean-room review history

Historical phase-gate audits are observation records, not architecture authority。Exact reports are under `docs/audits/`。

| Audit | Site revision | Infra counterpart | Verdict |
|---|---|---|---|
| #1 | `567c9082494579a1d0b3663eb31a96003b7d05cd` | `20da6a8c025ff4cf51db19974813f00ec83d6210` | FAIL — P0=0 / P1=13 / P2=1 |
| #2 | `300cb8624a52f5e4911380105ec10f1428188faf` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | FAIL — P0=0 / P1=2 / P2=1 |
| #3 | `7e0e6d605c36a544bb4001191c5bdb1cae5001e4` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | FAIL — P0=0 / P1=3 / P2=1 |
| #4 | `1cf7664d3d4b54f8cd5032c179d9240fa8c2e721` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | PASS — P0=0 / P1=0 / P2=3 |
| #5 | `f42e490c49bab795e6c15682611564ff0edd841c` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | **PASS — P0=0 / P1=0 / P2=0** |

## Freeze basis

The frozen target includes the product/architecture/contracts/operations/content/governance design and adopted ADR set enumerated by `freeze-manifest-2026-08-26.md`。

A specific usability condition reviewed by the operator is satisfied: the Article Job architecture does **not** require the user's local workstation as its semantic execution location。A ChatGPT-like agent may use authorized GitHub connectors/APIs, Web/source access, image generation, and remote/ephemeral deterministic execution backends while preserving the same artifact/state/disclosure/approval contracts。

This is an execution-location property of the existing frozen architecture, not authorization to bypass deterministic stages or permissions。

## Implementation gate

Design Freeze closed the design-review gate and made greenfield implementation **READY**。The implementation foundation and migration Phase 1 are accepted/merged。The next repository implementation phase is Phase 4 content identity/content migration; later taxonomy/media/route/provider/cutover phases remain separately gated。

Allowed after Freeze when explicitly tasked:

- create/extend the greenfield npm workspace/CI foundation;
- implement schemas/contracts/validators;
- implement provider-neutral Article Job machinery;
- implement local/remote execution adapters and test fixtures;
- create reviewed vNext content identity/migration records and migrated content on feature branches while retaining the frozen legacy source;
- implement later migration stages in plan order when their prerequisites are satisfied;
- run non-production measurements needed to close `design/open-decisions.md` values。

Still blocked until their own gates:

- production legacy cutover;
- old active implementation deletion before parity/rollback gates;
- production Cloudflare/R2/DNS/provider mutation;
- production Article Job external-provider activation before disclosure/profile/runtime fixtures pass;
- merge/deploy without the normal review/authorization workflow。

## Cross-repository provider gate

Website Cloudflare provider design counterpart is defined by `architecture/infrastructure-handoff.md`。

The counterpart remains a **Proposed post-Freeze sub-gate** in `Xpotato-Server`。Until it is explicitly accepted and the handoff is updated to an exact accepted/mutation-permitted revision:

- proposed website resource values are not current production desired state;
- no R2 bucket/DNS/Worker-domain/provider mutation is authorized by this site Freeze;
- mutable branch head is not authority。

## External AI activation gate

ADR-0026 and `article-external-ai-disclosure-v1` are adopted design semantics, but live production external-AI execution still requires implementation evidence。

Before production Article Job external-provider activation:

- the disclosure profile exists as versioned machine SoT;
- exact-set/hard-deny/derived-only validation fixtures pass;
- provider runtime credentials are scoped separately from disclosure authorization;
- provider-use permission cannot bypass input admission;
- relevant implementation audit/review gates pass。

Missing/invalid disclosure policy fails closed and blocks the external call。

## Remaining implementation-measurement decisions

`design/open-decisions.md` contains non-authoritative values intentionally deferred to implementation measurement/provider schema, including exact performance budgets, visual style details, selected module API details, exact provider versions/permissions/cutover selectors, future GC and measured bundle classes。

These do not reopen the frozen architecture unless resolving one requires a material semantic change。

## Post-Freeze architecture changes

Current amendment tracking:

- Legacy build reproduction/equivalence (ADR-0028 + `../contracts/legacy-build-reproduction-contract.md`): **ACCEPTED 2026-08-29** after fresh clean-room design audit of exact revision `fddcfe936b8bd0bcfa68a074ea808ca6f84ecc9e` (**PASS — P0=0 / P1=0 / P2=0**) and explicit operator acceptance。
- Unresolved legacy migration evidence (ADR-0029 + affected clauses in `../contracts/migration-inventory-contract.md`): **ACCEPTED 2026-08-29** by the same audited amendment acceptance。
- Frozen Astro/React island `uid` equivalence (ADR-0030 + `../contracts/legacy-build-astro-island-uid-amendment.md`): **ACCEPTED 2026-08-29** after fresh read-only design audit of exact revision `36aecac4f3342e8ee41b4332c0d0c6df6d37b0fe` (**PASS — P0=0 / P1=0 / P2=1**) and explicit operator acceptance。The P2 was lifecycle wording drift outside ADR-0030 semantics。
- Adoption records: `../design/amendment-acceptance-2026-08-29.md` and `../design/amendment-acceptance-adr-0030-2026-08-29.md`。

The audited proposal documents retain their exact `status: proposed` bytes; the amendment acceptance records and this lifecycle document are adoption authority for those exact audited semantics。

Implementation remediation for ADR-0028/0029/0030 is complete as part of accepted Phase 1A。The accepted `astro-react-island-uid-v1` class remains limited to the exact frozen PrimeFactorizer React `client:visible` binding and only the generated `uid` value; all other variance remains fail-closed。Phase 1B adds observational visual/performance evidence only and does not change these architecture semantics or establish hard performance budgets。

A material change to the frozen baseline requires:

1. explicit design task;
2. canonical SoT update;
3. new ADR or explicit superseding ADR when material;
4. affected exact-revision clean-room audit;
5. explicit operator acceptance when the change alters the frozen baseline。

Implementation details that merely instantiate an already-frozen contract do not require reopening unrelated architecture。

## Migration/cutover gate

Migration/cutover remains **BLOCKED** until the greenfield implementation reaches the parity/recovery conditions in `migration/greenfield-rebuild-plan.md`。

Before old implementation removal/cutover, the plan still requires the accepted immutable legacy tag/baseline plus completed content/media/route parity, recovery evidence, accepted provider handoff where needed, and rollback verification。
