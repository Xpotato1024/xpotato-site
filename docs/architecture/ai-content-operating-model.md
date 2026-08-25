---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job AI operating model
  - semantic and deterministic execution boundary
---

# AI Content Operating Model

## Execution roles

### Deterministic executor

Owns:

- job state
- source pinning / hashing
- request compilation
- response schema validation
- artifact publication
- fingerprints / manifests
- media tool invocation
- Astro candidate materialization / validation
- human approval ledger
- repository export

It does not invent article semantics.

### Source discoverer

Proposes relevant sources and why they matter. It does not declare an unpinned URL to be immutable evidence.

### Evidence analyst

Builds atomic evidence / ambiguity records from fixed source bundle.

### Article author

Produces draft / claims / metadata / taxonomy / visual-needs proposal from fixed evidence.

Current repository-local `$japanese-technical-blog` Skill is the initial authoring Skill candidate.

### Independent content auditor

Runs in fresh context. Re-extracts claims from draft and compares them with fixed evidence.

### Reviser

Responds to validated findings only. It does not silently rewrite the article into a different thesis.

### Visual planner

Maps the clean article to `source_media`, `ai_generated`, or `deterministic_cover` and builds a semantic visual brief.

### Image generator backend

Produces image bytes from compiled generation request. It is an adapter, not an authority over factual claims or article content.

### Independent visual auditor

Reviews selected visual with fresh context for relevance, factual misleadingness, accidental text / UI / logos, crop and quality.

### Human approver

Approves or rejects exact candidate package. AI cannot impersonate this role.

## AI exchange contract

Each semantic stage follows:

```text
request_path
+ Skill snapshot
+ response_schema_path
        |
        v
 semantic runner
        |
 provider-neutral response
        |
        v
 deterministic import / validation
        |
 canonical Article Job artifact
```

semantic runner does not receive write access to canonical job directories when avoidable.

## Provider neutrality

core domain depends on roles, not vendor model names.

interfaces:

```text
SourceDiscoveryBackend
TextSemanticBackend
ImageGenerationBackend
VisionAuditBackend
```

provider adapter is selected by version-controlled profile. credentials are environment / secret-store inputs and never committed into profile or manifest.

## Model profile

machine-readable profile owns:

- provider
- model / snapshot when available
- semantic role
- request defaults
- quality / size for image role
- timeout / bounded retries
- external API classification

canonical architecture prose does not pin a rapidly-changing model name as permanent design identity.

Current implementation may start with OpenAI adapters, but another provider or local backend must be replaceable without changing Article Job artifact contracts.

## Fixed Skill snapshot

request binds exact Skill bytes/hash rather than only Skill name.

historical completed job is validated against its stored Skill snapshot, not silently reinterpreted by a later Skill version.

pending request with material Skill drift should be regenerated or explicitly migrated.

## Context independence

content auditor must not inherit author private context as hidden truth.

visual auditor must not accept image-generator self-rating as sole quality gate.

fresh context is an operational requirement, not a cryptographic proof of independence. run lineage records provider/model/context identifiers where available.

## No chain-of-thought storage requirement

private reasoning / chain of thought is not a canonical artifact.

store:

- inputs
- structured outputs
- claim/evidence mapping
- findings
- resolutions
- model/Skill identity
- hashes / timestamps

These are sufficient for operational audit without depending on hidden reasoning traces.

## External API authorization

Article Job explicitly records permissions such as:

- web / network source access
- external text model
- external image generation
- external vision audit / moderation

lack of permission does not justify hidden provider call.

local / deterministic fallback may be used where defined.

## Failure policy

semantic response validation failure is not repaired by weakening schema or canonical gate.

- invalid response => retry same fixed request within budget or block
- missing evidence => block / narrow claim
- image generation failure => retry bounded candidates then deterministic cover
- audit P0/P1 => bounded revision or block
- human approval absent => no export

## Planned Skill topology

Article Job implementation justifies narrower explicit stage Skills than the original two-Skill bootstrap.

proposed semantic Skills:

- `discover-article-sources`
- `analyze-article-evidence`
- `japanese-technical-blog` — authoring stage, existing Skill can be narrowed/reused
- `independent-article-audit`
- `revise-article-from-audit`
- `plan-article-visuals`
- `independent-visual-audit`

`prepare-human-review` may be deterministic assembly rather than semantic Skill.

`run-article-job` can later be an orchestration Skill / CLI wrapper, but it must only invoke deterministic stage APIs and never bypass import validation.

initial stage routing should be explicit, not fuzzy implicit invocation. Full candidate/eval/promotion machinery can be introduced after real routing evidence exists.
