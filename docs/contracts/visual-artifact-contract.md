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

## ImageGenerationRequest

```ts
interface ImageGenerationRequest {
  providerProfileId: string;
  visualPlanSha256: string;
  styleProfileSha256: string;
  compiledPrompt: string;
  negativeConstraints: string[];
  outputProfileId: string;
}
```

executorがvisual plan + style + site restrictionsをcompileする。

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

prompt全文をpublic metadataへ埋め込まない。

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

## VisualAuditRecord

```ts
interface VisualAuditRecord {
  auditId: string;
  planId: string;
  targetAssetSha256: string;
  targetDraftSha256: string;
  result: "pass" | "revision_required" | "blocked";
  findings: VisualFinding[];
}
```

visual candidateが存在する場合、それぞれ独立audit対象。

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
- generated visual has provenance + visual audit
- social card derivation binds current title / visual / style profile
