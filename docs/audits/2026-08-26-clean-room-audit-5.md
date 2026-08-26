---
status: historical
owner: audit
performed_at: 2026-08-26
canonical_for: []
---

# Clean-room Phase-gate Audit #5

## Verdict

**PASS — P0=0 / P1=0 / P2=0**

This report is historical observation only. It does not promote Design, ADR, documentation, implementation, migration, or provider lifecycle state.

## Audited exact revisions

### xpotato-site

```text
repository: Xpotato1024/xpotato-site
revision: f42e490c49bab795e6c15682611564ff0edd841c
```

### Infrastructure counterpart

```text
repository: Xpotato1024/Xpotato-Server
revision: 6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d
ADR: docs/decisions/ADR-0024-website-cloudflare-control-plane-and-media-protection.md
ADR status: Proposed
website vNext sub-gate: OPEN / provider mutation BLOCKED
```

Mutable branch heads were not used as audit authority.

## Evidence boundary

Allowed evidence followed `docs/governance/audit.md` at the audited site revision:

- exact-revision `AGENTS.md`;
- exact-revision `docs/README.md` SoT map and reachable proposed canonical docs;
- exact-revision ADRs and lifecycle status;
- exact-revision migration/operations/contracts/profiles;
- exact SHA-pinned `Xpotato-Server` counterpart;
- authoritative upstream documentation only for current provider capability verification.

Not used as architecture authority:

- previous chat/model memory;
- uncommitted intent;
- mutable branch head;
- legacy `doc/` or old implementation as vNext SoT;
- Issue/PR discussion as replacement for missing specification;
- previous audit verdict as proof of current correctness.

## Audit axes

### 1. Lifecycle / governance

PASS.

The audited site revision unambiguously states:

- Design=`PRE_FREEZE_REVIEW`;
- implementation=`BLOCKED`;
- migration/cutover=`BLOCKED`;
- vNext Cloudflare provider activation=`BLOCKED`;
- audit PASS alone does not freeze/promote the design;
- exact operator acceptance remains required.

Clean-room procedure, severity, ADR lifecycle, and cross-repository exact-revision rules are repository-local and reachable from the SoT map.

### 2. Cross-repository provider lifecycle

PASS.

Site handoff pins exact infra revision `6d0a4e0...` and identifies ADR-0024 as Proposed.

At that exact infra revision:

- global Architecture v3 remains FROZEN;
- website vNext is an OPEN design sub-gate with provider mutation BLOCKED;
- proposed website R2/domain/rule values are not active desired state;
- `inventory/desired/cloudflare.yaml` contains no website vNext source/public/protected resource values.

Therefore proposal and active desired state are not conflated.

### 3. ADR lifecycle / identity / coverage

PASS.

ADR directory contains one record for each ID `0001` through `0027`; no duplicate ADR number remains.

- ADR-0016 Pagefind is `rejected`, not incorrectly `superseded`;
- ADR-0021 is the replacement MiniSearch proposal;
- stable ContentId has ADR-0023;
- ephemeral Article Job + durable compact lineage has ADR-0024;
- clean-room lifecycle has ADR-0025;
- external-AI exact input admission has ADR-0026;
- portable MDX + managed registries/modules has ADR-0027.

No material decision checked in this pass lacked a rationale owner.

### 4. Product -> content architecture

PASS.

The product purpose can be reconstructed without legacy implementation assumptions:

- AI-first but human-approved publishing;
- portable Markdown/MDX durable source;
- immutable UUIDv4 ContentId independent from route;
- managed taxonomy and semantic modules;
- Interactive Module Registry for runtime binding;
- derived SEO/discovery/media presentation state;
- static-first public site with route-local runtime only.

ADR-0027 explains the migration-heavy authoring-model trade-off while contracts own exact fields/props/seed values.

### 5. External AI disclosure trust boundary

PASS.

Provider-use permission and exact input disclosure are separate.

The chain is reconstructable as:

```text
ArticleJobSpec provider-use upper bound
 -> versioned disclosure policy binding
 -> materialized source/artifact identity
 -> ExternalAiDisclosureRecord
 -> optional local derived-only artifact
 -> exact ExternalAiDisclosureManifest
 -> final serialized-request secret/private checks
 -> external provider transport
```

Required invariants are consistent across product, Article Job, AI exchange, state machine, security policy, validation, retention, and ADR-0026:

- private/unknown default deny;
- actual secrets/capability material hard deny;
- `publicSafe`/citation/source trust do not imply disclosure;
- derived-only excludes raw source bytes;
- manifest input set exactly equals actual outbound provider artifact set;
- semantic AI/Skill/provider cannot self-authorize;
- denied required evidence cannot be silently omitted while claiming completeness.

Initial profile `article-external-ai-disclosure-v1` fixes launch defaults and is provider-neutral.

### 6. Evidence / claims / citations / cleanup-safe traceability

PASS.

Detailed Source/Evidence/Claim artifacts may remain job-private, but before export every material published Article Job claim must be transformed into durable `CompactMaterialClaimBinding` that resolves durable `CompactSourceRef` identities.

A deleted bundle hash alone is explicitly insufficient.

External AI runs retain safe policy/manifest/request lineage hashes without copying private source bodies/paths/full disclosure inventories into Git.

The retention contract blocks cleanup until required durable lineage exists at an operator-selected durable Git ref.

### 7. Article Job state / human approval / persistence

PASS.

Canonical persistence path is consistent across state machine, public media contract, AI operations, validation, and pipeline:

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

Failure semantics are consistent:

- source-store failure -> remain HUMAN_APPROVED/BLOCKED;
- public publication failure -> remain MEDIA_SOURCE_STORED/BLOCKED;
- protection failure -> remain MEDIA_PUBLISHED/BLOCKED;
- cleanup-safe lineage/export failure -> no EXPORTED/cleanup.

AI/Skill cannot create human approval or bypass persistence gates.

### 8. Media three-plane architecture / recovery

PASS.

The design cleanly separates:

1. private canonical source — privacy-normalized future re-encoding authority;
2. public delivery media — content-addressed browser-facing master/variants;
3. private protected exact bytes — current published-byte recovery authority.

Raw camera/provider originals are not site long-term SoT.

Git stores semantic/hash/profile/provenance/recovery identity, not photographic/raster bytes or provider credentials.

After job cleanup, exact public restore begins from:

```text
Git Media Registry expected SHA/key/size
 + Publication Provenance mediaRecovery protectedObjectRef
 -> infra resolver
 -> protected bytes
 -> SHA verification
 -> public content-addressed key republish
```

No past chat/full Article Job workspace is required.

Current provider proposal matches these three planes while remaining mutation-blocked.

### 9. Git / R2 placement and repository growth

PASS.

Object-storage-first policy covers photo/screenshot/raster content/project/site hero/AI/gallery media. Git allows small deterministic SVG/logo/favicon/icon/tiny texture/fixtures.

The design branch still changes only newly-added vNext design/agent material relative to `main`; existing legacy implementation files on `main` are not modified/deleted by the audited design revision.

### 10. Technical example execution

PASS.

AI-generated commands do not route directly to host execution.

`packages/example-verifier` is the only bounded execution boundary; initial executable profiles are limited to self-contained Python/Node/SQLite under network-none/non-root/resource-bounded sandbox semantics. Admin/cloud/package-manager/Docker/Git-remote mutation is excluded from automatic execution.

### 11. Static search / discovery

PASS.

Pagefind proposal is rejected. Current proposal uses MiniSearch + repository-owned deterministic Japanese/technical tokenizer shared by build and browser query path.

Search remains a rebuildable static artifact and does not become content SoT or server runtime dependency.

### 12. Cloudflare Dashboard minimization / provider neutrality

PASS.

Target control plane is Git-driven:

- site deploy: GitHub Actions + Wrangler;
- provider desired state: `Xpotato-Server`;
- OpenTofu where suitable;
- official API/CLI/narrow adapter for gaps;
- R2 configuration admin operator-ephemeral and off persistent CP/site-CI trust;
- Dashboard limited to bootstrap/billing/account recovery/break-glass/true API-gap.

Cloudflare Images/custom Cache/Compression/CORS rules are not correctness dependencies.

Current upstream capability check was compatible with the proposal: R2 Bucket Lock supports API/Wrangler management, including indefinite retention and rule removal. This is supporting provider evidence only and must be reverified at provider acceptance/implementation as the infra ADR requires.

### 13. AI provider profile freshness

PASS.

Current upstream verification on 2026-08-26 confirms the configured initial model IDs remain available:

- `gpt-5.6-sol`;
- `gpt-5.6-terra`;
- `gpt-image-2`;
- `gpt-image-2-2026-04-21` snapshot.

Model/profile choice remains versioned implementation configuration and does not alter content/disclosure contracts.

### 14. Migration / legacy archive / rollback boundary

PASS.

Migration remains blocked before Design Freeze. After acceptance it requires:

- immutable annotated legacy tag;
- exact cutover inventory regeneration;
- old build reproduction;
- stable ContentId/content/taxonomy/media/interactive migration;
- source/public/protected media coverage before active raster removal;
- route/SEO/search parity;
- accepted infra handoff before provider mutation;
- rollback verification before old implementation removal/cutover.

Legacy source is preserved by Git identity rather than copied into active `archive/old-src`.

Exact provider cutover commands and performance/visual values remain implementation/measurement details, not ambiguous architecture authority.

### 15. Open decisions

PASS.

Remaining open items are explicitly non-authoritative and limited to implementation measurement/provider-specific details:

- exact performance byte budgets;
- visual style profile;
- Comparison child API fixture;
- exact legacy tag string;
- exact Cloudflare/Wrangler/provider versions/permissions/cutover selectors;
- future privileged media GC;
- measured interactive bundle classes.

None is required to determine current security, approval, storage, recovery, content identity, provider ownership, or migration safety semantics.

## Findings

No P0, P1, or P2 finding was identified on the audited exact revisions.

```text
P0 = 0
P1 = 0
P2 = 0
```

## Final verdict

**PASS — P0=0 / P1=0 / P2=0**

This PASS makes the design eligible for an explicit operator Design Freeze decision under `architecture/design-status.md`.

It does **not** by itself:

- change `PRE_FREEZE_REVIEW` to `FROZEN`;
- promote proposed documents to canonical;
- promote proposed ADRs to accepted;
- accept infra ADR-0024;
- open implementation/migration/provider mutation;
- create/modify Cloudflare/R2/DNS resources;
- merge the design branch.

Those remain separate explicit decisions/actions.
