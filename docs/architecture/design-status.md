---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - vNext design lifecycle
  - design freeze gate
  - implementation and migration activation gate
---

# vNext Design Status

## Current status

- Design: **PRE_FREEZE_REVIEW**
- Implementation: **BLOCKED**
- Legacy migration/cutover: **BLOCKED**
- Cloudflare provider activation for vNext: **BLOCKED**

vNext documents/ADRs are design proposals until explicit operator acceptance。File existence or audit PASS alone does not promote them to current production architecture。

## Clean-room review history

Historical phase-gate audits are observation records, not architecture authority。Exact reports are under `docs/audits/`。

| Audit | Site revision | Infra counterpart | Verdict |
|---|---|---|---|
| #1 | `567c9082494579a1d0b3663eb31a96003b7d05cd` | `20da6a8c025ff4cf51db19974813f00ec83d6210` | FAIL — P0=0 / P1=13 / P2=1 |
| #2 | `300cb8624a52f5e4911380105ec10f1428188faf` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | FAIL — P0=0 / P1=2 / P2=1 |
| #3 | `7e0e6d605c36a544bb4001191c5bdb1cae5001e4` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | FAIL — P0=0 / P1=3 / P2=1 |
| #4 | `1cf7664d3d4b54f8cd5032c179d9240fa8c2e721` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | PASS — P0=0 / P1=0 / P2=3 |
| #5 | `f42e490c49bab795e6c15682611564ff0edd841c` | `6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d` | **PASS — P0=0 / P1=0 / P2=0** |

Audit #5 is the latest clean-room design phase-gate result. It makes the audited design revision eligible for an explicit operator Design Freeze decision, but **does not itself freeze the design**。Design remains `PRE_FREEZE_REVIEW` until the operator explicitly accepts the design and performs the deliberate status promotion described below。

## Design Freeze gate

Design can be promoted from `PRE_FREEZE_REVIEW` to `FROZEN` only when:

1. proposed canonical SoT is internally consistent;
2. material decisions have ADRs with correct lifecycle status;
3. exact cross-repository dependencies are SHA-pinned;
4. fresh clean-room phase-gate audit on exact revisions has P0=0/P1=0;
5. remaining P2/open parameters are explicitly compatible with later implementation measurement;
6. operator explicitly accepts Design Freeze;
7. accepted/canonical status promotion is made as a deliberate change, not inferred from audit PASS。

## Implementation gate

Production/migration implementation does not begin while Design=`PRE_FREEZE_REVIEW`。

Allowed before freeze:

- design docs/ADR/contracts/profiles;
- read-only inventory;
- benchmark/evaluation needed to close design questions;
- isolated non-production spike only if explicitly scoped as disposable evidence。

Blocked before freeze:

- old implementation deletion;
- production Cloudflare/R2/DNS mutation;
- greenfield runtime cutover;
- legacy media removal;
- production Article Job activation。

## Cross-repository provider gate

Website Cloudflare provider design counterpart is defined by `architecture/infrastructure-handoff.md`。

The counterpart currently remains a **Proposed post-Freeze sub-gate** in `Xpotato-Server`。Until both sides are accepted:

- no proposed website resource value is treated as current production desired state;
- no R2 bucket/DNS/Worker-domain/provider mutation is authorized by site design docs;
- mutable branch head is not an audit authority。

## External AI activation gate

External AI provider use is also not enabled merely by choosing an AI model profile。

Before production Article Job external-provider activation:

- ADR-0026/external disclosure contract is accepted as part of Design Freeze;
- `operations/external-ai-disclosure-profile.md` is implemented as versioned machine SoT;
- request exact-set/hard-deny/derived-only validation fixtures pass;
- provider runtime credentials are scoped separately from disclosure authorization;
- a user/job provider-use permission cannot bypass input admission。

Missing/invalid disclosure policy fails closed and blocks the external call。

## Remaining implementation-measurement decisions

`design/open-decisions.md` contains non-authoritative items whose exact values require implementation measurement/provider schema at that phase。

Open item existence is not automatically blocking。It is blocking only if current phase cannot implement/review safely without the value。

## Adoption action after PASS

After a fresh clean-room PASS, operator acceptance should:

- change adopted target docs `status: proposed -> canonical` where appropriate;
- change adopted ADRs `status: proposed -> accepted`;
- keep rejected/superseded ADR history;
- record exact freeze revision and audit result here;
- then open implementation/migration gate according to the accepted plan。

Audit agent must not perform this promotion merely because it produced a PASS report。
