---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job artifact and lineage model
---

# Article Artifact Model

## Principles

- source artifact is immutable after acquisition
- derived artifact must trace to exact inputs
- semantic AI response and canonical job artifact are separated
- draft/verification/audit/visual/candidate artifacts are versioned
- identity is artifact ID/hash, not local path
- external-AI provider permission and per-artifact disclosure admission are separate
- human approval precedes persistent media/site mutation
- media binary is never exported to Git as normal content state
- raw camera/provider originals are not long-term site storage authority
- privacy-normalized canonical source is future reprocessing authority
- public delivery media is not the only recovery authority
- baseline responsive media is an exact deterministic prebuilt artifact set
- full private job workspace is ephemeral; cleanup-safe semantics are compacted into durable Git/media planes
- private chain-of-thought is not a required artifact

## Artifact classes

| Class | Examples | Canonical in job | Durable Git |
|---|---|---:|---:|
| source | SourceRecord, pinned snapshot refs | Yes | CompactSourceRef |
| disclosure | ExternalAiDisclosureRecord, ExternalAiDisclosureManifest | Yes/versioned | safe policy/manifest hash lineage only |
| evidence | atomic evidence/ambiguity ledger | Yes | compact material-claim support ledger |
| authoring | draft, claims, metadata proposal | Yes/versioned | final MDX/metadata + claim support binding |
| citation | logical markers, compilation manifest | Yes | compiled footnotes + hash |
| example verification | records/results/log refs | Yes/versioned | summary/hash |
| audit | content/visual findings | Yes/versioned | hash/limitations summary as required |
| generated raw visual | provider output bytes | Yes/immutable | no |
| canonical media source | lossless WebP/sanitized SVG | Yes/immutable | hash/profile identity only |
| media variants | delivery master + AVIF/WebP/fallback | Yes/immutable | object refs/hash only |
| candidate | exact approval target | Yes/versioned | candidate/approval refs |
| preview | build manifest/screenshots | Regenerate/bind | no |
| approval | HumanApprovalRecord | Append-only | hash/time/reviewer provenance |
| canonical source storage | source-media receipt | Yes | compact source identity + receipt hash |
| media publication | public delivery manifest | Yes | media refs + manifest hash |
| media protection | full protection receipt | Yes | receipt hash + compact recovery binding |
| publication provenance | cleanup-safe revision lineage | Yes | Yes |
| definition | schemas/Skills/profiles/policies | Repository SoT | Yes |

## Artifact envelope

```ts
interface ArtifactRecord {
  artifactId: string;
  artifactType: string;
  contentSha256: string;
  sizeBytes: number;
  relativeStoragePath: string;
  inputArtifactIds: string[];
  producer: {
    kind:
      | "deterministic"
      | "semantic_ai"
      | "image_generator"
      | "human"
      | "infrastructure_adapter";
    name: string;
    version: string;
  };
  configurationSha256: string;
  createdAt: string;
  warnings: string[];
}
```

AI additional lineage:

- semantic role
- provider/model/snapshot
- Skill ID/hash
- request/schema fingerprints
- execution mode local/external
- external-AI disclosure policy/manifest hash for external runs

## External AI disclosure artifacts

Exact semantics=`../contracts/external-ai-disclosure-contract.md` / ADR-0026。

### Source/artifact admission

Each source/artifact that may enter an external provider request resolves a hash-bound disclosure record independently from:

- `publicSafe`
- citation eligibility
- trust class
- job-level provider-use permission

Unknown/private defaults deny; actual secret-bearing bytes hard-deny。

### Derived-only representation

If policy is `allow_derived_only`, a local deterministic transform creates a separate artifact with its own hash and disclosure record。Raw source is not an outbound provider input。

### Request disclosure manifest

Every external semantic/vision/image request has an exact `ExternalAiDisclosureManifest` whose entry set equals the physical outbound provider input artifact set。

The manifest is itself a private job artifact and binds:

- job/request/stage
- policy ID/hash
- exact/derived request artifact hashes
- disclosure record hashes
- final secret-scan result
- manifest hash

Provider adapter cannot append hidden input after manifest compilation。

### Durable treatment

Full private disclosure records/manifests may be deleted at workspace cleanup。Long-term provenance retains only safe lineage such as policy ID/hash and manifest hash associated with the AI run, never raw private input, private path, or secret-bearing authorization detail。

## Source / Evidence / Claim

Exact semantics=`../contracts/source-evidence-claim-contract.md`。

During job execution:

- SourceRecord -> exact source identity + disclosure ref
- EvidenceRecord -> proposition + exact SourceRefs
- ArticleClaimRecord -> draft span + evidence IDs

A disclosure-denied source may still support locally-produced evidence. That does not make the source/evidence externally disclosable later。

Before durable export, exporter converts every published material claim into `CompactMaterialClaimBinding[]` from `publication-provenance-contract.md`。This preserves claim -> evidence interpretation -> source identity after detailed job artifacts are deleted。

Transition/non-material prose need not be kept in the durable claim ledger。

## Citation / technical examples

- citation: `../contracts/citation-export-contract.md`
- technical examples: `../contracts/technical-example-verification-contract.md`
- runtime profile: `../operations/technical-example-profiles.md`

AI citation strings are not source authority。Example verification logs may be deleted after durable summary/hash and cleanup eligibility are satisfied。

## Visual / media artifacts

Canonical source:

- privacy-normalized lossless WebP / safe SVG
- exact SHA/dimensions/profile/toolchain/source lineage

Delivery variants:

- generated only after visual audit
- deterministic profile
- exact SHA/size/dimensions/content type

Candidate media set binds canonical source + ingest profile + variant manifest + delivery profile + rights/provenance。

External vision/image-generation use of article context/reference images is separately disclosure-gated; local media existence does not imply external image admission。

## Candidate binding

Candidate binds at least:

- ContentId / MDX / frontmatter / route
- source bundle / evidence bundle / claim ledger
- cleanup-safe material claim ledger proposal
- citation and technical-example manifests
- content/visual audits
- canonical media source/profile
- delivery variants/profile
- source-storage/publication/protection plans
- Media Registry proposal
- pre-persistence provenance proposal
- taxonomy/module snapshots
- repository base/build fingerprint

External-AI disclosure records/manifests are operational trust artifacts rather than article content bytes. Their safe run/hash lineage can be exported without changing the candidate content/media/support meaning。

Changing material content/support/media/profile makes approval stale。

## Post-approval persistence artifacts

```text
HUMAN_APPROVED
 -> CanonicalSourceStorageReceipt
 -> MediaPublicationManifest
 -> MediaProtectionReceipt
 -> CompactMediaRecoveryBinding
 -> EXPORTED
```

These post-approval operational artifacts bind the exact candidate/approval. If persistence requires changing content/media/support, create a new candidate rather than mutating approval target。

## MediaProtectionReceipt versus durable recovery binding

Full MediaProtectionReceipt is a private job artifact and may later be cleaned up。

Before export/cleanup, deterministic exporter derives secret-free `CompactMediaRecoveryBinding` containing:

- protection class / policy fingerprint / full receipt hash
- each required public object SHA/key/size
- each opaque protectedObjectRef

Object sets must exactly match MediaPublicationManifest and full receipt。

## Repository export

Prerequisite:

- HumanApprovalRecord
- current compact material claim support ledger
- external AI runs have valid request/disclosure lineage
- CanonicalSourceStorageReceipt set/not_required
- MediaPublicationManifest
- MediaProtectionReceipt/empty result
- compact media recovery binding when published media exists
- repository base/current candidate validation

Git export:

- MDX/frontmatter
- Media Registry
- compact CanonicalSourceRecord identity
- Publication Provenance including SourceRefs/materialClaims/mediaRecovery/AI run lineage
- safe disclosure policy/manifest hash lineage for external runs
- separately approved taxonomy/interactive changes

Never export:

- raw/canonical/variant media bytes
- full source snapshots
- full disclosure records/manifests containing private inventory
- full AI request/response
- verifier logs
- prompt/private reasoning
- protected media bytes

## Cleanup relationship

`../operations/article-job-retention-policy.md` / ADR-0024。

Cleanup is allowed only after exact durable Git ref contains cleanup-safe provenance and all required source/disclosure/public/protection chains validate。Full detailed evidence/disclosure/receipts can then be removed from the local job workspace without losing required claim traceability, AI-run audit hash lineage, or media restore entrypoint。

## Workspace layout

```text
.local/article-jobs/<job-id>/
├─ job.json
├─ sources/
├─ disclosure/records|derived|manifests/
├─ evidence/
├─ authoring/requests|responses|drafts/
├─ citations/
├─ examples/records|results|logs/
├─ audit/content/
├─ visuals/plans|generated/raw|normalized|audits/
├─ media/canonical|variants/
├─ candidate/vNNN/
├─ preview/vNNN/
├─ approval/records.jsonl
├─ publication/source|public|protection/
└─ manifests/stages/
```

`.local/` is Git ignored。

## Schema SoT

Implementation uses `packages/content-contracts` TypeScript/Zod as machine-readable SoT and generates AI exchange JSON Schema。Disclosure/admission, durable provenance, and media receipt schemas are part of that machine SoT; prose cannot silently diverge。
