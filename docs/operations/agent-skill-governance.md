---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - repository-local agent and Skill governance
---

# Agent and Skill Governance

## Knowledge placement

| Medium | Responsibility |
|---|---|
| `AGENTS.md` | always-on router / safety / read-first |
| `docs/` | product/architecture/contracts/operations/governance SoT |
| `.agents/skills/` | narrow semantic workflow |
| deterministic packages/CLI | pin/validate/process/state/artifact/compact provenance |
| typed external operation | AI/storage/provider/deploy side effect |
| CI/validator | machine invariant |
| Issue/PR/Git state | task-specific state |
| ADR | decision provenance |
| audit report | exact-revision observation only, not policy |

Do not duplicate full detailed rules across layers。

## Lifecycle / audit

Agent reads `architecture/design-status.md` before implementation/provider mutation decisions。

Clean-room phase-gate behavior is owned by `governance/audit.md` and `governance/severity.md`。A Skill cannot promote an ADR/doc or open an implementation/provider gate。

Material cross-repository provider state is read only from exact `architecture/infrastructure-handoff.md` binding, not mutable branch head/past chat。

## Semantic Article Job Skills

- `discover-article-sources`
- `analyze-article-evidence`
- `draft-japanese-technical-article`
- `independent-article-audit`
- `revise-article-from-audit`
- `plan-article-visual`
- `independent-visual-audit`

Manual support:

- `japanese-technical-blog`
- `site-content-publish`

Production semantic request fixes exact Skill/reference snapshot; fuzzy auto-chain is not canonical workflow。

## Ownership

Semantic Skills:

- source candidate/relevance
- evidence/ambiguity proposal
- draft/claims
- independent findings
- bounded revision
- visual plan/audit findings

Deterministic executor/packages:

- source acquisition/pinning/hash
- request/response schema/hash
- state/artifact writes
- citation compilation
- example verifier orchestration
- raw -> privacy-normalized canonical media
- delivery variant generation
- candidate/preview
- human approval record plumbing (not decision)
- storage receipt validation
- **cleanup-safe CompactSourceRef / material-claim evidence ledger derivation**
- **cleanup-safe compact media recovery binding derivation**
- repository export
- cleanup eligibility

Typed external operations:

- authorized AI provider call
- approved canonical source-media store/retrieve
- approved public delivery upload/reuse
- protected exact-byte copy/reuse
- production deploy
- provider mutation

Skill cannot self-report an external operation as canonical success or advance state by assertion。

## Source/evidence durable boundary

`discover-article-sources` only proposes candidates. Pin/fetch/hash = executor。

Detailed evidence/claim artifacts may be job-private, but every **published material Article Job claim** must receive cleanup-safe durable support mapping before export:

```text
published statement hash/locator
 -> compact evidence proposition/interpretation
 -> durable CompactSourceRef identity
```

Skill does not manufacture this durable ledger independently of validated detailed artifacts. Compacting cannot strengthen evidence or omit a material claim。

## Technical examples

Execution is not Skill capability。

Only `packages/example-verifier` + `operations/technical-example-profiles.md` may perform bounded allowlisted execution。

Initial automatic sandbox classes:

- Python stdlib
- self-contained Node
- disposable SQLite

Shell/system/cloud/package/Docker/Git-remote mutations are not automatic execution scope。

## Media boundary

Semantic visual planner/auditor handles intent/relevance/safety, not persistent storage。

Deterministic local media tool handles HEIC decode/orientation/sRGB/private metadata strip/lossless canonical source/prebuilt variants without remote persistence。

After exact human approval:

```text
canonical source storage
 -> public delivery publication
 -> protected exact-byte copy/full receipt
 -> compact mediaRecovery binding
 -> repository export
```

Skill must not:

- upload raw camera original as canonical source
- authorize rights-unknown media
- expand source/public/protected credentials
- self-report Bucket Lock/config state
- substitute receipt hash for durable protected object recovery refs

## Human approval

Human-only exact candidate confirmation。AI/Skill/convenience runner cannot synthesize reviewer/confirm authority。

## Permission / side-effect boundary

ArticleJobSpec permission is only an upper bound。

- semantic Skills -> private structured proposals
- local media/example processors -> local bounded artifacts
- source/public/protected object operations -> separate explicit typed capabilities after approval/current lifecycle
- repository export -> separate explicit permission after full durable lineage/persistence validation
- deploy/provider mutation/merge -> separate authorization

Permission=true never overrides design/provider lifecycle/human approval/provider credential gate。

## Skill lifecycle

Implementation minimum:

- positive/negative routing tests
- required inputs/forbidden actions
- validated Skill only production binding
- Skill/reference hash snapshot
- pending request drift -> stale

AI model/resource budget belongs to `operations/ai-execution-profiles.md`, not Skill prose。

## Full Article Job retention / cleanup

Full private job workspace is not permanent archive requirement (ADR-0024)。Skill does not own retention/deletion decision。

Explicit cleanup requires `operations/article-job-retention-policy.md`, including:

- exact exported bytes/provenance at operator-selected durable Git ref
- valid cleanup-safe **material claim -> evidence/source bindings**
- valid canonical source/public/protection persistence chain
- valid cleanup-safe **CompactMediaRecoveryBinding** when media exists
- no unresolved external/orphan tracking need
- explicit operator confirmation

Receipt/bundle hashes alone do not satisfy cleanup if required semantics/restore locator would disappear with workspace deletion。

Cleanup deletes exact job workspace only; no Git/R2 deletion。
