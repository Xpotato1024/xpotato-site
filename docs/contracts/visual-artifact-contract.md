---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - visual planning contract
  - generated image record contract
  - collection visual requirements
---

# Visual Artifact Contract

## Collection visual requirements

visual requirementはcollectionごとに異なる。

```ts
interface CollectionVisualPolicy {
  collection: "blog" | "notes" | "projects" | "tools" | "pages";
  hero: "required" | "optional" | "none";
  socialCard: "required" | "derived_if_needed" | "site_default";
}
```

initial semantics:

- Blog: hero required, social card required
- Notes: hero optional
- Projects: hero / overview / gallery optional
- Tools: hero optional。interactive UIそのものをhero扱いしない
- Pages: page-specific requirementがなければhero none

exact policy tableはmachine-readable site configをSoTとする。

## VisualPlanSet

```ts
interface VisualPlanSet {
  schemaVersion: 1;
  targetDraftSha256: string;
  collection: string;
  plans: VisualPlan[];
}
```

`plans=[]`を許可する。ただしcollection policyでhero requiredならhero-less setはinvalid。

## VisualPlan

```ts
interface VisualPlan {
  planId: string;
  strategy:
    | "source_media"
    | "ai_generated"
    | "deterministic_cover"
    | "deterministic_diagram";

  purpose: "hero" | "inline_concept" | "inline_evidence" | "diagram" | "overview";

  concept: string;
  articleRelation: string;
  sourceEvidenceIds: string[];

  factuality: "decorative" | "conceptual" | "evidence_backed";
  forbiddenDepictions: string[];

  composition?: {
    aspectRatio?: string;
    safeAreaProfile?: string;
    focalPlacement?: string;
  };

  styleProfileId?: string;
  sourceMediaRefs: string[];

  semanticAssetId: string;
  altProposal?: string;
  disclosureClass: "none" | "ai_generated" | "composite";
}
```

## Strategy rules

### AI generated

- hero / inline conceptのみ
- default factuality = conceptual
- `inline_evidence`禁止
- fake UI / terminal / code / benchmark等をhard restrictionにできる

### Source media

camera / screenshot / evidence-backed diagram等。

`inline_evidence`ではevidence/source ref required。

### Deterministic diagram

architecture / data flow / measured chart等、source dataから再生成可能なvisual。

factual software visualではAI illustrationより優先できる。

### Deterministic cover

Blog hero fallback等。content/design metadataから再生成できるdecorative visual。

## External AI disclosure boundary

Visual planning/generation/audit follows `external-ai-disclosure-contract.md` / ADR-0026。

Important distinctions:

- `externalImageAI=true` allows use of an external image provider but does not authorize sending a raw photo/screenshot/private article context;
- `externalTextAI=true` allows an external visual-audit/vision backend but does not admit the audited image automatically;
- publication rights do not imply provider disclosure rights;
- a metadata-stripped local canonical/derived image can be admitted while its raw camera original remains denied。

Any external visual/image request must bind an exact `ExternalAiDisclosureManifest` for all article/source/image/prompt-context artifacts sent to the provider。

## ImageGenerationRequest

```ts
interface ImageGenerationRequest {
  providerProfileId: string;
  visualPlanSha256: string;
  styleProfileSha256: string;
  compiledPrompt: string;
  compiledPromptSha256: string;
  negativeConstraints: string[];
  outputProfileId: string;
  externalAiDisclosureManifestSha256: string;
}
```

Executor compiles visual plan + style + site restrictions into a request artifact。

The compiled prompt itself is an external artifact. If it is derived from private sources, the disclosure manifest must prove the prompt/context is admitted and contains no hard-deny secret/private bytes outside the authorized mode。

Raw source image/reference editing is allowed only when that exact image is `allow_exact`; otherwise use an admitted local derivative or do not send it。

## GeneratedImageRecord

```ts
interface GeneratedImageRecord {
  semanticAssetId: string;
  origin: "ai_generated";
  articleDraftSha256: string;
  evidenceBundleSha256: string;
  visualPlanSha256: string;

  provider: string;
  model: string;
  modelSnapshot?: string;
  providerProfileSha256: string;
  styleProfileSha256: string;
  promptSha256: string;
  requestSha256: string;
  externalAiDisclosureManifestSha256: string;

  rawSha256: string;
  normalizedSha256?: string;
  generatedAt: string;

  provenanceSignals: {
    c2paDetected?: boolean;
    synthIdExpected?: boolean;
  };

  visualAuditId?: string;
}
```

prompt全文/private contextをpublic metadataへ埋め込まない。

## SourceMediaRecord

```ts
interface SourceMediaRecord {
  semanticAssetId: string;
  origin: "camera" | "screenshot" | "diagram";
  sourceArtifactSha256: string;
  normalizedSha256: string;
  privacyMetadataStripped: boolean;
  evidenceIds: string[];
}
```

SourceMediaRecord publication identity does not itself authorize external AI disclosure。Raw and normalized/derived artifacts have independent disclosure records。

## VisualAuditRecord

```ts
interface VisualAuditRecord {
  auditId: string;
  planId: string;
  targetAssetSha256: string;
  targetDraftSha256: string;
  result: "pass" | "revision_required" | "blocked";
  findings: VisualFinding[];
  externalAiDisclosureManifestSha256?: string;
}
```

visual candidateが存在する場合、それぞれ独立audit対象。

If the auditor is external, target visual/article context must pass exact disclosure admission。If target is not externally admissible, use an approved local auditor or BLOCK/require review; do not silently replace with an incomplete external audit。

material finding:

- fake / misleading UI
- fake terminal / code / benchmark
- articleと無関係
- unintended text
- crop failure
- publication policy breach

visualが0件のcollectionではempty audit manifestを生成できる。

## VisualAuditManifest

```ts
interface VisualAuditManifest {
  targetDraftSha256: string;
  audits: VisualAuditRecord[];
  result: "pass" | "revision_required" | "blocked";
}
```

collection-required visual不足は`blocked`。

## Social card derivative

Blog social cardはselected hero + actual article metadataからdeterministic生成する。

- actual title
- category label
- branding
- safe-area

AI modelへarticle titleのraster text描画を要求しない。

heroがrequiredでないcollectionではsite-default background + actual metadataでdeterministic social cardを生成できる。

## Validation

- collection visual policy satisfied
- semantic asset IDs unique within content
- AI-generated inline evidence prohibited
- source evidence visual has evidence refs
- external image/vision request has exact valid disclosure manifest
- `externalImageAI`/`externalTextAI` alone never admits raw image/context
- generated visual has provenance + visual audit
- social card derivation binds current title / visual / style profile
