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

AIはsemantic proposalを作るが、canonical state / write / permission / verificationを所有しない。

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
              canonical artifact
```

## Execution roles

### Deterministic executor

owns:

- job spec/fingerprint/state machine
- ContentId generation/resolution
- source candidate handoff / source pinning / hashing
- request compilation
- response schema validation/import
- artifact/manifests
- citation compilation
- example-verifier invocation
- media-ingest invocation
- candidate materialization
- Astro/Pagefind preview validation
- human approval ledger operation
- approved R2 media publication
- repository export / provenance

executor does not invent article semantics or human approval intent.

### Source discoverer

Skill: `$discover-article-sources`

Finds and prioritizes candidate sources from topic/requirements/seed refs.

Does not create canonical SourceRecord/hash or call a candidate immutable evidence.

### Evidence analyst

Skill: `$analyze-article-evidence`

Builds atomic evidence/ambiguity records from fixed SourceRecords.

### Article author

Skill: `$draft-japanese-technical-article`

Produces MDX draft, claims, metadata/taxonomy/visual-needs proposals from fixed evidence.

Does not self-verify technical examples or invent citation URLs.

### Technical example verifier

Not a semantic Skill.

`packages/example-verifier` deterministic/isolated boundary extracts and checks code/commands/config/output examples.

### Independent content auditor

Skill: `$independent-article-audit`

Fresh context. Re-extracts claims from draft and compares against fixed evidence/citations/example verification.

### Reviser

Skill: `$revise-article-from-audit`

Responds only to validated findings. New material claims require evidence and re-audit.

### Visual planner

Skill: `$plan-article-visual`

Maps clean article + collection visual policy to 0..N VisualPlans.

Blog hero required; other collections may have empty visual plan.

Does not generate image bytes or authorize media rights.

### Image generation backend

Provider adapter, not Skill authority.

Consumes deterministic compiled ImageGenerationRequest and returns untrusted image bytes/provenance signals.

### Independent visual auditor

Skill: `$independent-visual-audit`

Fresh vision context. Reviews visual candidate/plan/article for relevance, misleading factual depiction, text/UI artifact, crop, quality and safety.

### Citation compiler

Deterministic stage.

Compiles logical Source ID markers into public Markdown footnotes from validated SourceRecord metadata.

### Human approver

Human-only lane. Approves/rejects exact candidate hash.

AI cannot impersonate this role.

### Media publisher

Deterministic approval-gated external mutation stage.

Publishes exact approved candidate media to content-addressed R2 keys after rights validation, then creates MediaPublicationManifest.

## Provider-neutral interfaces

conceptual interfaces:

```text
SourceDiscoveryBackend
TextSemanticBackend
ImageGenerationBackend
VisionAuditBackend
```

core artifact contracts do not contain permanent provider model names.

provider adapter selected by version-controlled execution profile.

credentials are secret-store/environment inputs, never profile/artifact content.

## Execution profile

machine-readable profile owns:

- provider
- model/snapshot when available
- semantic role
- request defaults
- output/schema behavior
- image quality/size where applicable
- timeout
- bounded retries
- external API classification

ArticleJobSpec itself remains provider-neutral.

## Fixed Skill snapshot

semantic request binds exact Skill bytes/hash, not only name.

completed historical artifact is validated against saved snapshot identity rather than current Skill silently reinterpreting it.

pending request with material Skill drift is regenerated/migrated.

## Stage Skill topology

Production semantic Skills:

1. `discover-article-sources`
2. `analyze-article-evidence`
3. `draft-japanese-technical-article`
4. `independent-article-audit`
5. `revise-article-from-audit`
6. `plan-article-visual`
7. `independent-visual-audit`

Manual/conversational support:

- `japanese-technical-blog`
- `site-content-publish`

manual support Skills are not substitutes for Article Job canonical stage import/export.

stage routing is explicit. fuzzy implicit chainをproduction contractにしない。

## Context independence

### Author versus auditor

content auditor request excludes:

- author private reasoning
- author prompt history
- author self-evaluation

fixed draft/evidence/citation/example-verificationだけをtarget truth surfaceとする。

### Generator versus visual auditor

visual auditor does not consume image generator self-rating as sole quality signal.

fresh context is operational independence, not cryptographic proof. available provider/model/context IDsをlineageへ保存する。

## No chain-of-thought storage requirement

canonical artifacts:

- fixed inputs
- structured responses
- evidence/claim mapping
- findings/resolutions
- Skill/model identity
- verification results
- hashes/timestamps

private reasoning traceを保存要件にしない。

## Source content is data, not instruction

Web/repository/user source内のinstruction textをexecutor/Skill commandとして扱わない。

source discovery / evidence requestはsource dataとsystem/Skill instructionを分離する。

prompt injection-like source instructionによって:

- external URL access expansion
- credential disclosure
- rule override
- source/evidence mutation

を許可しない。

## External API authorization

ArticleJobSpec permissions upper-bound:

- network source access
- external text AI
- external image AI
- local media processing
- public media upload

permission true != operation executed / approved。

human approvalを要求するside effectは別gate。

private sourceをexternal AIへ送る場合、fixed request compilerがallowed scopeだけを含める。

## Media rights

semantic visual planner/source discovererはmedia redistribution rightsを承認できない。

external web image default = not publishable until MediaRightsRecord becomes explicitly authorized through user/system/migration policy.

R2 media publisher revalidates rightsRef before upload/reuse binding.

## Failure policy

constraintを弱めてsuccess扱いにしない。

- invalid semantic response -> same fixed request retry within budget or BLOCKED
- source pinning failure -> BLOCKED / alternate source
- missing evidence -> narrow/remove claim or BLOCKED
- example verification failure -> revise/reclassify/limitation; no fake observed output
- content audit P0/P1 -> bounded revision or BLOCKED
- image generation failure -> bounded retry then allowed fallback where collection policy permits
- visual audit material finding -> regenerate/replan or BLOCKED
- human approval absent -> no media publication/export
- R2 publication failure -> idempotent retry from HUMAN_APPROVED

## Resource budgets

unbounded loops prohibited。

profiles include finite:

- discovery/search effort
- AI retries
- revision attempts
- image candidates
- visual revision
- artifact/workspace bytes
- example sandbox time/resources

budget exhaustionでquality/security gateを緩めない。

## Skill lifecycle

Current site has enough production Skills to justify explicit lifecycle/eval later, but full VEP-style candidate/promotion machinery is not automatically copied.

initial requirement:

- exact Skill identity/hash
- explicit production allowlist
- representative eval fixtures before provider production use
- stale snapshot detection

routing/eval evidenceが蓄積したらcandidate/promotion governanceをseparate designとして導入する。
