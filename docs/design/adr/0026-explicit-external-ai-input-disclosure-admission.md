---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0026: external AIへのinput disclosureをprovider-use permissionから分離しexact admissionする

## Context

AI-first Article Job may use external search/text/vision/image providers while inputs can include:

- public official docs/repositories
- user notes/logs
- private repository material
- screenshots/photos
- derived evidence/context
- accidentally secret-bearing data

A broad boolean such as `externalTextAI=true` is enough to say “an external provider may be used”, but not enough to answer **which exact user/source-derived bytes may leave the local trust boundary for which stage/use**。

Publication/citation safety is also different: a source can be private/non-citable but explicitly admitted to an external model, or public/citable but still excluded by policy from a particular provider request。

Without a separate admission contract, implementations can legitimately diverge into either over-disclosure or unusably conservative behavior。

## Decision

Adopt a separate provider-neutral external-AI disclosure layer defined by `contracts/external-ai-disclosure-contract.md`。

### Independent dimensions

Keep separate:

- source authority/trust
- public publication safety
- citation eligibility
- external AI disclosure admission
- provider-use capability

None automatically implies another。

### Default deny

- private input: deny until explicit admitted representation/use
- restricted input: no full disclosure
- unknown classification: deny until resolved
- actual secret/capability-bearing material: hard deny
- public input: may be admitted only by versioned system/repository policy plus normal provider-use capability

### Per-representation admission

External requests use exact/hash-bound representations rather than arbitrary local paths/objects。

Admission distinguishes exact/full input from locally-created derived/redacted representation。Derived-only means the raw source does not leave the local boundary。

### Exact outbound request manifest

Every external search/text/vision/image request is preceded by a deterministic `ExternalAiDisclosureManifest` that binds:

- request/job/use
- exact representation hashes
- their admission records/modes
- disclosure policy identity
- exact compiled outbound request hash

Provider runner does not transmit unless the manifest entry set equals the actual dynamic outbound input set and hard-deny checks pass。

### Search/image are included

Search query strings, image-generation prompts, article context, screenshots/photos, and vision inputs are outbound data and follow the same admission model。

### Denied required evidence

A denied source cannot be silently dropped while the resulting article is represented as fully evidenced。

Allowed resolution:

- admitted local derivative
- approved local/non-external backend
- explicit human/repository authorization where appropriate
- narrow/remove the dependent claim
- limitation/BLOCKED

### Durable lineage

Full disclosure manifests remain private Article Job artifacts。Cleanup-safe Git provenance retains only safe policy/manifest hashes and provider/run lineage, never private input bodies/paths/secret-bearing authorization details。

## Alternatives

### `externalTextAI=true` means all fixed evidence may be sent

Simple but leaks private/restricted material and conflates provider capability with data authorization。Rejected。

### Never send any private input to external AI

Safe by default but prevents intentionally authorized use cases such as analyzing a user-provided private log/screenshot with an external model。Too restrictive as a universal rule。

### Rely on prompt instructions/model to redact secrets

The source must already be sent before the model can redact it, so this does not protect disclosure. Rejected。

### Reuse `publicSafe` / citation eligibility

Publication and provider disclosure have different trust/consent semantics. Rejected。

### One global “private data allowed” toggle

Still too broad; lacks exact use/representation lineage and changes blast radius for unrelated inputs. Rejected。

## Consequences

Positive:

- external provider use can coexist with private inputs without implicit leakage
- request-level audit can prove which exact representation was admitted
- publication/citation rules stay semantically clean
- provider/model changes cannot silently widen data access
- denied required evidence has an explicit failure path

Costs:

- input IDs/disclosure records/manifests/derived-artifact validation are additional Article Job artifacts
- user/repository policy may need explicit admission decisions
- every external provider adapter must integrate the manifest gate

## Revisit triggers

- all semantic AI moves to a locally trusted backend
- provider supports a materially stronger local/confidential execution trust model that changes data-boundary requirements
- regulated/enterprise policy requires a stricter classification taxonomy
- practical use shows the current exact/derived modes are insufficient

## Related

- `contracts/external-ai-disclosure-contract.md`
- `contracts/article-job-contract.md`
- `contracts/ai-exchange-execution-contract.md`
- `architecture/security-privacy-policy.md`
- `architecture/ai-content-operating-model.md`
