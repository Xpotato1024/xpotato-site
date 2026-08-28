---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job semantic AI exchange contract
  - AI execution profile boundary
---

# AI Exchange and Execution Contract

## Separation

Article Jobの意味入力とAI provider/model設定、および**external providerへ開示可能なexact input set**を分離する。

- `ArticleJobSpec`: 何を作るか + provider-use upper bounds + disclosure policy binding
- `SemanticRequest`: stage-specific semantic task
- `ExternalAiDisclosureManifest`: external providerへ実際に送るexact artifact admission
- `AIExecutionProfile`: provider/model/escalation/budget policy
- `SemanticResponse`: provider-neutral structured response
- `ImageGenerationProfile`: visual-planからimage bytesを得るprovider profile
- deterministic importer/runner: schema/lineage/disclosure/policy validation

## SemanticStage

```ts
type SemanticStage =
  | "source_discovery"
  | "evidence"
  | "author"
  | "content_audit"
  | "revision"
  | "visual_plan"
  | "visual_audit";
```

image generationはstructured semantic responseとは異なるため`SemanticStage`に入れない。

## SemanticRequestEnvelope

```ts
interface SemanticRequestEnvelope {
  schemaVersion: 1;
  requestId: string;
  jobId: string;
  jobFingerprint: string;
  stage: SemanticStage;

  inputArtifacts: ArtifactRef[];

  skill: {
    skillId: string;
    skillSha256: string;
    referenceBundleSha256: string;
  };

  responseSchema: {
    schemaId: string;
    schemaSha256: string;
  };

  constraints: {
    maxOutputBytes: number;
    publicSafetyRequired: boolean;
    externalFactPolicy:
      | "discover_candidates_only"
      | "fixed_sources_only";
  };

  executionMode: "external" | "local";
  externalAiDisclosureManifestSha256?: string;

  requestSha256: string;
}
```

rules:

- `source_discovery` -> `discover_candidates_only`
- evidence/author/audit/revision/visual_plan/visual_audit -> `fixed_sources_only`
- `executionMode=external` -> current disclosure manifest required
- `executionMode=local` -> external disclosure manifest not used as proof of provider disclosure

source discoveryがWeb search toolを使っても、その結果をevidence factへ直接昇格しない。

AI runnerは`requestSha256`をresponseへechoし、importerが完全一致を検査する。

## External input admission

Exact semantics=`external-ai-disclosure-contract.md` / ADR-0026。

For every `executionMode=external` request:

1. determine final serialized/provider input artifacts;
2. build/validate `ExternalAiDisclosureManifest`;
3. require manifest entry set exactly equals actual external input artifact set;
4. prove derived-only records reference admitted derived bytes, not raw source;
5. reject unknown/deny/stale/hash-mismatched records;
6. reject hard-deny secret-bearing material even if job external-AI permission is true;
7. run final request secret/private exclusion validation;
8. bind disclosure manifest hash into request/run lineage;
9. only then call provider。

`publicSafe`, citation eligibility, source trust, or `externalTextAI=true` are never substitutes for this admission。

If a material/required source cannot be externally admitted, the stage must use an allowed local/derived path or preserve a limitation/BLOCKED result; it cannot silently omit the evidence and claim completeness。

## AIExecutionProfile

provider selection / effort / budget / escalationはversion-controlled profileが所有する。

```ts
interface AIExecutionProfile {
  schemaVersion: 1;
  id: string;

  semanticStageBindings: Record<SemanticStage, ProviderProfileId>;
  imageGenerationProfileId: ImageGenerationProfileId;

  budgetProfileId: string;
  escalationPolicyId: string;
}
```

## ProviderProfile

```ts
interface ProviderProfile {
  id: string;
  capability: "text" | "vision" | "search";
  provider: string;
  model: string;
  snapshot?: string;
  transport: string;
  optionsProfileId: string;
}
```

provider固有parameterの全種類をdomain schemaへ押し込まない。provider adapterのtyped options profileが所有する。

secret/API key/organization/account IDはprofileへ保存しない。

## ImageGenerationProfile

```ts
interface ImageGenerationProfile {
  id: string;
  provider: string;
  model: string;
  snapshot?: string;
  transport: string;
  optionsProfileId: string;
}
```

image generationはstructured output schemaを返さないproviderでもよい。

Executorがrequest/response bytes、provider metadata、raw hashをgeneration artifactへbindする。

Every external image-generation request must also bind `ExternalAiDisclosureManifest` for any article/source/image/context artifact sent to the provider。A generated prompt derived from private input is itself a request artifact and must be admitted; `externalImageAI=true` does not authorize arbitrary raw source images or private context。

## Budget profile

resource limitをprovider model profileと分離する。

```ts
interface ArticleAIBudgetProfile {
  id: string;
  perStageMaxInvocations: Record<SemanticStage, number>;
  maxTotalSemanticInvocations: number;
  maxSearchToolCalls: number;
  maxImageGenerationAttempts: number;
  maxSemanticRevisionCycles: number;
  maxTransientRetriesPerInvocation: number;
  textTimeoutSeconds: number;
  imageTimeoutSeconds: number;
}
```

budget exhaustionでcontractを弱めず`BLOCKED`。

## Escalation policy

lower-cost/default profileからhigher-capability profileへ自動escalateできる条件をversion-controlする。

allowed triggers candidate:

- repeated strict-schema import failure
- material evidence contradiction unresolved
- auditor confidence below threshold on P0/P1 classification
- visual audit ambiguity with publication impact

Escalation:

- exact semantic target/input identity維持
- disclosure admission再検証; different provider/profile does not inherit an invalid disclosure grant
- lineageへdefault/escalated modelを両方記録
- human approvalを代替しない
- resource budget内

でなければならない。

単に「より良い答えが欲しい」だけで無制限high-capability modelへ昇格しない。

## SemanticResponseEnvelope

```ts
interface SemanticResponseEnvelope<T> {
  schemaVersion: 1;
  requestSha256: string;
  stage: SemanticStage;
  response: T;
  runner: {
    provider: string;
    model: string;
    snapshot?: string;
    providerRunId?: string;
    executionProfileId: string;
    providerProfileId: string;
    externalAiDisclosureManifestSha256?: string;
    startedAt: string;
    finishedAt: string;
    externalApiUsed: boolean;
    toolUseSummary?: string[];
    warnings: string[];
  };
}
```

model identityはlineageでありprovider内部実行を暗号学的に証明するものではない。

## Import/run rules

Before external run:

- job external provider permission
- disclosure manifest exact-set admission
- final request secret/private checks

Importer then verifies at least:

- request hash
- job/stage
- response schema strict validation
- unknown field rejection
- UTF-8/bytes limit
- current permission
- Skill snapshot eligibility
- referenced artifact identity
- request/runner disclosure manifest lineage一致 for external runs
- stage-specific semantic invariant

失敗responseはcanonical workspaceへpublishしない。

## Fresh context

`content_audit`と`visual_audit`はauthor/generatorとfresh contextで実行する。

physical requestへ次を含めない。

- author private reasoning
- previous hidden chain of thought
- author/generator self-evaluationを正解とするfield

必要なtarget artifactとfixed evidenceだけを渡す。ただし**fixedであることはexternal disclosure permissionを意味しない**。External auditor runでも各input disclosure admissionが必要。

## Source discovery

source discoveryはsemantic stageだがsource acquisitionではない。

AI/Web search output:

- candidate URL/repository/document identity
- why relevant
- expected claim coverage
- freshness concern

まで。

deterministic source acquisition/pinningがactual URL/GitHub revision/retrieved identity/disclosure recordを確定して初めてSourceRecordになる。

## Retry taxonomy

### Transport retry

- timeout/5xx/rate transient等
- same request hash/input/disclosure manifest
- finite backoff
- semantic revisionではない

### Contract retry

- malformed/strict-schema-invalid response
- same input/response schema/disclosure admission
- bounded retry
- response/disclosure constraintを弱めない

### Semantic revision

- auditor findingに基づくexplicit revision stage
- separate artifact/version
- new/changed inputs require fresh disclosure admission
- `maxSemanticRevisionCycles`対象

## Storage / durable lineage

Request/response/disclosure manifests are private Article Job artifacts by default。

Public repositoryへprovider response全文、prompt、private disclosure inventory、private reasoningをautomatic commitしない。

Publication Provenance may retain safe lineage:

- disclosure policy ID/hash
- external request disclosure manifest hash
- exact/derived mode summary where useful

without retaining private source bodies, private artifact paths, or secret-bearing authorization details。
