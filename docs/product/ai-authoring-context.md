---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - AI-first article authoring product context
  - human and AI responsibility boundary
---

# AI-first Article Authoring Context

## Product assumption

vNext Blog publishingは**AI-first**をstandardとする。Human author is not required to write a complete article from scratch。

Human provides topic/intent/reader, available notes/repos/logs/media, provider-use permissions, and where applicable exact external-AI input disclosure authorization。Pipeline performs source discovery, evidence construction, draft, technical-example assessment, independent audit, bounded revision, visual planning/generation/audit, candidate preview。

AI-first != autonomous publishing。

- AI produces semantic proposals。
- deterministic executor validates requests/responses/artifacts/state。
- AI cannot write canonical content, authorize private input disclosure, or create human approval。
- persistent media/provider mutation starts only after exact human approval。
- Git export happens only after source/public/protected persistence and cleanup-safe provenance succeed。

## Human role

1. topic / reader outcome / scope
2. public/private publication boundary
3. permission to use external text/vision/image providers
4. **separate exact authorization for private/local inputs that may be disclosed externally**, when needed
5. available notes/repo/log/photo inputs
6. preview + material claims/limitations/audits/media plan review
7. exact candidate approve/reject/change request
8. later cleanup/freeze/deploy/provider mutation where separate operator gate requires it

Provider-use permission and input disclosure permission are deliberately separate。A human saying “external AI may be used” does not mean all private logs/photos/repositories may be transmitted。

Explicit private-input disclosure intent is normalized by deterministic executor into exact hash-bound admission records after the actual input is materialized。Semantic AI does not interpret vague prose into a broader data grant。

## External AI disclosure boundary

Exact contract=`../contracts/external-ai-disclosure-contract.md` / ADR-0026。

Core rules:

- private/unknown external disclosure defaults deny
- actual credentials/secrets/capability-bearing URLs are hard-deny
- `publicSafe` / citation eligibility / source trust do not imply provider disclosure
- admitted modes are exact, derived-only, or deny
- derived-only means local redacted/normalized derivative only; raw source never leaves the trusted boundary
- every external text/vision/image request carries an exact disclosure manifest
- manifest input set must equal actual outbound provider input set
- changed input hash invalidates prior admission
- AI/Skill/provider cannot self-authorize or widen disclosure

### If required evidence is denied

Do not silently remove it and present the output as fully evidenced。

Allowed paths:

- create an admitted safe local derivative
- use an approved local/non-external backend
- ask for explicit authorization when appropriate
- narrow/remove the dependent claim
- preserve a limitation / `BLOCKED` state

Human review must see material limitations caused by unavailable evidence, without unnecessarily revealing the private source itself。

## Semantic role separation

Do not combine search/draft/image/self-audit/write/publish into one agent。

Roles:

- source discoverer
- evidence analyst
- article author
- independent content auditor
- bounded reviser
- visual planner
- independent visual auditor

Image generator is provider adapter receiving a fixed visual request after any external-input admission gate, not approval/factual/disclosure authority。

## Article Job artifacts and durable boundary

During execution, Article Job keeps detailed private artifacts:

- job spec
- source records/snapshots
- external-AI disclosure records / derived artifacts / request manifests
- evidence/ambiguity ledger
- semantic requests/responses
- versioned drafts/claim ledger
- technical example records/results/logs
- visual plan/raw generated image/audits
- candidate/preview
- approval
- source/public/protection receipts

However full private job workspace is **not** a permanent archive requirement。

Before workspace cleanup, deterministic export must preserve long-term requirements as compact durable state:

### Git durable state

- approved MDX/frontmatter
- ContentId/routes/taxonomy
- Media Registry
- compact SourceRefs
- **material published claim -> evidence interpretation -> source binding**
- compact AI/tool lineage hashes
- safe disclosure policy/manifest/run hashes where external AI was used
- canonical media source SHA/profile/storage class
- publication/protection hashes
- **cleanup-safe protected media recovery binding** including secret-free protected object refs

### Durable media planes

- private canonical source: future re-encode authority
- public delivery: active published bytes
- protected media: exact published-byte recovery authority

Full prompts/private source bodies/raw logs/private disclosure manifests/private reasoning do not become Git/public state merely for audit convenience。

## Material claim traceability success condition

It is not enough that a deleted evidence bundle once had a hash。

After job cleanup, repository revision must still answer:

> このmaterial claimはどのevidence interpretationとどのsource identityに基づいたか？

using only durable Git provenance/source identities, without past chat or deleted Article Job artifacts。

Version-sensitive future update still revalidates current sources; old durable provenance is a seed/history, not current truth。

## External-run audit success condition

After cleanup, Git does **not** need to reproduce every private outbound byte。It must, however, retain enough safe lineage to show that an external AI run was bound to:

- exact request/run identity
- versioned disclosure policy
- exact disclosure manifest hash

without retaining private source bodies/paths or secret-bearing authorization details。

If a disclosure/security incident is unresolved, the relevant private job artifacts are held explicitly and normal cleanup is blocked until disposition。

## Hero image requirement

Published Blog candidate has a hero visual。

Preference:

1. source/real media when actually informative and publishable
2. AI conceptual illustration when no useful real hero
3. deterministic design-system cover if generation unavailable/disallowed/unsuitable

Image API failure is not a publication single point of failure。

External image generation/vision does not receive raw private photos/screenshots merely because `externalImageAI=true`; each prompt/context/reference image must pass the same disclosure admission model。

## Generated visual is not evidence

AI hero may explain/decorate a concept but cannot be represented as observed factual media。

Do not fabricate as evidence:

- non-existent UI
- unexecuted terminal output
- fake code/config
- unobserved benchmark/chart/number
- faux photographed hardware state
- unsupported logo/endorsement

Actual UI/terminal/graph requires source screenshot or deterministic evidence-derived visualization。

## Hero / social card separation

```text
source / AI / deterministic hero
          |
          v
 deterministic social-card renderer
 actual title/category/brand
          |
          v
        OGP
```

Image generation model does not render canonical article title text as truth source。

## Visual provenance

AI-generated visual internal lineage includes at least:

- origin
- provider/model/snapshot identity
- visual style/profile
- request hash
- disclosure manifest hash for external context/input where applicable
- raw generated bytes hash while job exists
- canonical/delivery artifact hashes
- article/evidence/candidate binding
- generation time
- visual audit result

Prompt/private source text need not be publicly exposed or permanently stored after cleanup。Origin must not be lost in durable provenance。

## Persistent media sequence

After human approval:

```text
approved canonical source
 -> private canonical source storage/reuse
 -> public delivery publication/reuse
 -> protected exact-byte copy/reuse
 -> compact recovery binding
 -> repository export
```

If persistent operation requires changing article/media/support bytes, approval is stale and a new candidate is required。

## Success criteria

- topic + permitted **and disclosure-admitted where external** inputs can reach HUMAN_REVIEW_READY reproducibly
- broad external-AI provider permission never silently discloses private input
- hard-secret input cannot be sent through ordinary Article Job authorization
- denied required evidence produces derivative/local/authorization/claim-narrowing/BLOCKED behavior rather than silent omission
- AI cannot directly update canonical content
- detailed claim/evidence model is validated during job
- published material claims remain source/evidence traceable after full job cleanup
- content audit independent from author context
- Blog hero always resolved through real/AI/deterministic strategy
- generated hero never treated as factual observation
- human approval binds exact content/media/support candidate
- persistent media operations bind same approval
- repository export preserves cleanup-safe material-claim, external-run disclosure hash, and recovery lineage
- old chat/private workspace is not required to explain material support or restore published media
