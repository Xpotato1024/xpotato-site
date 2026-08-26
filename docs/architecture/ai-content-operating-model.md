---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job AI operating model
  - semantic and deterministic execution boundary
---

# AI Content Operating Model

## Core principle

AI creates semantic proposals but does not own canonical state, write permission, human approval, verification, media persistence, or cleanup eligibility。

```text
fixed request + Skill snapshot + response schema
                    |
                    v
               semantic AI
                    |
              private response
                    |
                    v
       deterministic validation/import
                    |
             versioned job artifact
```

## Deterministic executor owns

- job spec/fingerprint/state machine
- ContentId generation/resolution
- source acquisition/pinning/hashing
- request compilation / response validation/import
- artifact/manifests
- citation compilation
- technical-example verifier invocation
- media ingest/variant invocation
- candidate materialization
- Astro + MiniSearch preview/build validation
- human approval record plumbing (not decision)
- source/public/protected media operation orchestration through typed capabilities
- durable compact provenance derivation
- repository export
- cleanup eligibility validation

Executor does not invent article semantics or human intent。

## Semantic roles

### Source discoverer — `$discover-article-sources`

Proposes/prioritizes candidate sources。Does not pin or declare canonical evidence identity。

### Evidence analyst — `$analyze-article-evidence`

Builds atomic evidence/ambiguity candidates from fixed SourceRecords。

### Author — `$draft-japanese-technical-article`

Produces draft/claims/metadata/taxonomy/visual needs from fixed evidence。Does not invent citation URLs or self-verify examples。

### Independent content auditor — `$independent-article-audit`

Fresh context; re-extracts material claims and checks evidence/citations/example results。

### Bounded reviser — `$revise-article-from-audit`

Only validated findings; new material claims require evidence + re-audit。

### Visual planner — `$plan-article-visual`

Clean article -> semantic visual plans。Does not generate bytes or authorize rights。

### Image generation backend

Provider adapter consumes deterministic ImageGenerationRequest and returns untrusted bytes/provenance signals。

### Independent visual auditor — `$independent-visual-audit`

Fresh vision context checks relevance, misleading factual depiction, UI/text artifact, crop/quality/provenance/safety concerns。

## Deterministic non-AI stages

### Source pinning

Candidate locator -> exact SourceRecord/source hash。

### Technical example verifier

`packages/example-verifier` only bounded execution boundary。No host-direct arbitrary commands。

### Citation compiler

Fixed Source ID markers -> validated public Markdown citation/footnote representation。

### Durable claim lineage compiler

Before approval/export, detailed claim/evidence/source artifacts -> cleanup-safe public-safe compact material claim support proposal/binding。

AI does not author this durable ledger as authority; deterministic compiler/validator owns equivalence to detailed approved support semantics。

### Human approver

Human-only exact candidate approval。

### Media persistence stages

After human approval only:

```text
canonical source persistence
 -> public delivery persistence
 -> protected exact-byte persistence
 -> durable recovery binding
```

All stages bind same candidate/approval. If persistence would require changing content/media/support, approval stale。

## Provider-neutral interfaces

Conceptual:

- SourceDiscoveryBackend
- TextSemanticBackend
- ImageGenerationBackend
- VisionAuditBackend
- CanonicalMediaStorageBackend
- PublicMediaPublicationBackend
- ProtectedMediaBackend

Core content/artifact contracts do not permanently encode provider model/resource identifiers。

Provider/model options are versioned execution profiles; credentials are runtime secret inputs only。

## Fixed Skill snapshot

Every semantic request binds exact Skill content/reference hash, not name alone。

Completed artifact remains tied to historical snapshot identity; current Skill cannot silently reinterpret it。

Production semantic Skill topology:

1. discover-article-sources
2. analyze-article-evidence
3. draft-japanese-technical-article
4. independent-article-audit
5. revise-article-from-audit
6. plan-article-visual
7. independent-visual-audit

Manual support Skills do not replace canonical Article Job stages。

## Context independence

Content auditor does not receive author private reasoning/prompt history/self-evaluation as truth。

Visual auditor does not use generator self-rating as quality authority。

Fresh context is operational independence, not proof; run/model/Skill hashes remain lineage metadata。

## Durable audit boundary / no CoT requirement

Detailed private job artifacts may include structured requests/responses/evidence/claims/findings/logs, but private chain-of-thought is never required。

Long-term Git provenance after cleanup keeps only safe required semantics:

- compact SourceRefs
- material claim -> evidence/source bindings
- AI/Skill/model/request/response hashes
- example verification summary/hash
- canonical media source identity
- publication/protection hashes
- compact protected recovery binding

Full prompts/source snapshots/detailed evidence/private reasoning are not launch-required long-term archive data。

## Source data is not instruction

Web/repository/user source text is data, not executor/Skill command。

Source prompt injection cannot expand external access, reveal credentials, override rules, or mutate evidence/state。

## External authorization

ArticleJobSpec permissions upper-bound actions such as:

- source network access
- external text/vision AI
- external image AI
- local media processing
- persistent canonical source storage
- public media upload
- protected-media operation

Permission true is not approval/execution proof。Persistent media still requires exact human approval and infrastructure lifecycle/credential gates。

Private source sent to external AI is limited by deterministic request compiler/public-private scope validation。

## Media rights

Source discoverer/visual planner cannot authorize redistribution rights。

External Web image default is non-publishable until explicit valid MediaRightsRecord。Publisher revalidates rights before persistence。

## Failure policy

Never weaken constraints to get success。

- invalid AI response -> bounded same-contract retry or BLOCKED
- source pin failure -> alternate source/BLOCKED
- evidence missing -> narrow/remove claim or BLOCKED
- example failure -> revise/reclassify/limitation, never fake observed result
- content audit P0/P1 -> bounded revision/BLOCKED
- image generation failure -> bounded retry/fallback
- visual material finding -> replan/regenerate/BLOCKED
- human approval absent -> no persistent media/export
- canonical source persistence failure -> stay HUMAN_APPROVED
- public publication failure -> stay MEDIA_SOURCE_STORED
- protection failure -> stay MEDIA_PUBLISHED
- durable claim/recovery binding failure -> no EXPORTED/cleanup

## Resource budgets

Finite profile limits cover discovery/search, semantic retries, revision cycles, image attempts, sandbox resources, timeouts, and output/workspace sizes as appropriate。

Budget exhaustion never downgrades correctness/security/recovery gate。

## Skill lifecycle

Initial requirement:

- exact Skill identity/hash
- production allowlist
- representative eval fixtures
- stale snapshot detection

Do not import full VEP candidate/promotion machinery until real routing/eval evidence justifies it。
