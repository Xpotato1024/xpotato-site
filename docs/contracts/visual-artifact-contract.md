---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - visual plan contract
  - generated image record contract
  - hero asset contract
---

# Visual Artifact Contract

## VisualPlan

```ts
interface VisualPlan {
  schemaVersion: 1;
  targetDraftSha256: string;
  strategy: "source_media" | "ai_generated" | "deterministic_cover";
  purpose: "hero" | "inline_concept" | "inline_evidence" | "diagram" | "social_card";

  concept: string;
  articleRelation: string;
  sourceEvidenceIds: string[];

  factuality: "decorative" | "conceptual" | "evidence_backed";
  forbiddenDepictions: string[];

  composition: {
    aspectRatio: string;
    safeAreaProfile: string;
    focalPlacement?: string;
  };

  styleProfileId: string;
  sourceMediaRefs: string[];

  altProposal?: string;
  disclosureClass: "none" | "ai_generated" | "composite";
}
```

AI generated heroは原則 `factuality = conceptual`。

`inline_evidence` をAI画像で生成しない。

## ImageGenerationRequest

visual plannerの自然言語をそのままproviderへ送らない。

executorが次をcompileする。

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

## GeneratedImageRecord

```ts
interface GeneratedImageRecord {
  assetId: string;
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

prompt全文をpublic content metadataへ埋め込まない。private Article Job artifactでは保存可能。

## SourceMediaHeroRecord

camera / screenshot / diagramは別recordを持つ。

```ts
interface SourceMediaHeroRecord {
  assetId: string;
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
  targetAssetSha256: string;
  targetDraftSha256: string;
  result: "pass" | "revision_required" | "blocked";
  findings: VisualFinding[];
}
```

material finding例:

- fake / misleading UI
- fake terminal / code / benchmark
- articleと無関係なconcept
- unintended text
- critical crop failure
- unsafe trademark implication
- publication policy breach

## OGP derivative

OGPはhero visualからdeterministicに生成する。

- actual article title
- category label
- branding
- safe-area

をsoftware rendererが合成する。

AI画像生成modelへtitle描画を要求しない。
