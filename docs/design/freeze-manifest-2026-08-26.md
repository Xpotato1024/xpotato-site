---
status: canonical
owner: architecture
accepted_at: 2026-08-26
canonical_for:
  - vNext Design Freeze adoption manifest
  - audited baseline adoption scope
---

# vNext Design Freeze Manifest — 2026-08-26

## Decision

The operator explicitly accepts the audited vNext design for implementation.

Design content baseline:

```text
repository: Xpotato1024/xpotato-site
audited_revision: f42e490c49bab795e6c15682611564ff0edd841c
audit: Clean-room Audit #5
verdict: PASS — P0=0 / P1=0 / P2=0
```

Infrastructure counterpart used by that audit:

```text
repository: Xpotato1024/Xpotato-Server
revision: 6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d
ADR-0024 status: Proposed
website provider mutation: BLOCKED
```

This manifest adopts the exact audited site design baseline. It does **not** accept or activate the Proposed infrastructure counterpart.

## Why Freeze is valid for ChatGPT/remote-agent authoring

The frozen design does not require the human user's local workstation to be the Article Job execution location.

The architecture is defined in terms of:

- ArticleJobSpec / state / artifact identity / SHA-256 lineage;
- semantic AI roles;
- deterministic executor responsibilities;
- provider-neutral source/media/repository interfaces;
- exact human approval;
- durable Git/R2 state.

Therefore a ChatGPT-like agent may perform source discovery, GitHub repository reads/writes through an authorized connector/API, semantic authoring/audit, and image generation without using the user's local PC, provided the same contracts, disclosure gates, deterministic validation, approval and persistence rules are satisfied.

`.local/article-jobs/` is a local execution workspace convention, not the durable identity of an Article Job. A remote/ephemeral execution backend may implement the same artifact/state contracts. This does not authorize bypassing deterministic stages or provider/action permissions.

## Adopted canonical design scope

The following are adopted as the frozen target design **at the exact audited revision above**:

- all product, architecture, contract, content, governance and operations documents reachable from the `docs/README.md` Source of Truth Map;
- the greenfield migration/rebuild plan as the target migration sequence;
- repository-local Agent/Skill boundaries that implement or enforce those target semantics;
- the external-AI disclosure profile `article-external-ai-disclosure-v1`;
- the AI execution, media processing, technical-example and static-search profiles defined in the audited baseline.

Supporting/historical evidence remains non-authoritative:

- `docs/audits/`;
- `docs/migration/current-site-inventory-2026-08-26.md` except as explicitly referenced migration evidence;
- `docs/design/open-decisions.md` for measurement/provider details;
- `docs/legacy/` and old `doc/` / legacy implementation.

## ADR adoption

Accepted by this Freeze decision:

```text
ADR-0001 through ADR-0015
ADR-0017 through ADR-0027
```

ADR-0016 remains **Rejected** and is not accepted.

The ADR files at the audited baseline retain their pre-Freeze `status: proposed` bytes so the audited design content remains byte-identical. For the frozen baseline, **this manifest + `architecture/design-status.md` are the adoption authority**. New post-Freeze ADRs are not accepted by implication and use their own lifecycle until an explicit later decision.

## Lifecycle after Freeze

```text
Design: FROZEN
Implementation: READY / not started
Legacy migration/cutover: BLOCKED until implementation/parity gates
Cloudflare provider activation: BLOCKED until Xpotato-Server ADR-0024 is accepted and the exact handoff is updated
Production Article Job external-provider activation: BLOCKED until implementation fixtures/credentials/gates pass
```

Freeze authorizes beginning the greenfield implementation **only when explicitly tasked**. It does not itself perform implementation, migration, merge, deployment, R2/DNS/Worker mutation, or legacy deletion.

## Post-Freeze change rule

Material architecture changes require:

1. explicit design task;
2. new/updated canonical SoT;
3. new ADR when the decision is material;
4. affected exact-revision clean-room audit;
5. explicit operator acceptance when the change alters the frozen baseline.

Implementation measurements that fill already-declared open parameters may be recorded without reopening unrelated architecture, provided they do not change frozen semantics.

## Legacy implementation preservation

The old implementation remains untouched at Freeze time.

When implementation begins, the migration plan requires an immutable annotated legacy tag before old active implementation removal. The active vNext tree will be rebuilt greenfield; a full `archive/old-src` copy is not kept in the active source tree.
