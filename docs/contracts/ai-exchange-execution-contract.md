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

Article Jobの意味入力とAI provider / model設定を分離する。

- `ArticleJobSpec`: 何を作るか
- `SemanticRequest`: stage-specific semantic task
- `AIExecutionProfile`: provider/model/escalation/budget policy
- `SemanticResponse`: provider-neutral structured response
- `ImageGenerationProfile`: visual-planからimage bytesを得るprovider profile
- deterministic importer: schema / lineage / policy validationとartifact publication

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

  requestSha256: string;
}
```

rules:

- `source_discovery` -> `discover_candidates_only`
- evidence/author/audit/revision/visual_plan/visual_audit -> `fixed_sources_only`

source discoveryがWeb search toolを使っても、その結果をevidence factへ直接昇格しない。

AI runnerは`requestSha256`をresponseへechoし、importerが完全一致を検査する。

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

secret / API key / organization/account IDはprofileへ保存しない。

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

executorがrequest/response bytes、provider metadata、raw hashをgeneration artifactへbindする。

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

escalationは:

- exact request/input artifactを維持
- lineageへdefault/escalated modelを両方記録
- human approvalを代替しない
- resource budget内

でなければならない。

単に「より良い答えが欲しい」だけで無制限Sol/max等へ昇格しない。

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
    startedAt: string;
    finishedAt: string;
    externalApiUsed: boolean;
    toolUseSummary?: string[];
    warnings: string[];
  };
}
```

model identityはlineageでありprovider内部実行を暗号学的に証明するものではない。

## Import rules

importerは少なくとも:

- request hash
- job / stage
- response schema strict validation
- unknown field rejection
- UTF-8 / bytes limit
- current permission
- Skill snapshot eligibility
- referenced artifact identity
- stage-specific semantic invariant

を検証する。

失敗responseはcanonical workspaceへpublishしない。

## Fresh context

`content_audit`と`visual_audit`はauthor / generatorとfresh contextで実行する。

physical requestへ次を含めない。

- author private reasoning
- previous hidden chain of thought
- author/generator self-evaluationを正解とするfield

必要なtarget artifactとfixed evidenceだけを渡す。

## Source discovery

source discoveryはsemantic stageだがsource acquisitionではない。

AI/Web search output:

- candidate URL/repository/document identity
- why relevant
- expected claim coverage
- freshness concern

まで。

deterministic source acquisition/pinningが:

- actual URL status
- GitHub commit/blob
- retrieved timestamp
- content/snapshot identity

を確定して初めてSourceRecordになる。

## Retry taxonomy

retryを3種類に分離する。

### Transport retry

- timeout/5xx/rate transient等
- same request hash
- finite backoff
- semantic revisionではない

### Contract retry

- malformed/strict-schema-invalid response
- same input/response schema
- one bounded retry candidate
- response schemaを弱めない

### Semantic revision

- auditor findingに基づくexplicit revision stage
- separate artifact/version
- `maxSemanticRevisionCycles`対象

これらを同じ「retry count」に混ぜない。

## Storage

request / response / runner lineageはprivate Article Job workspaceへ保存する。

public repositoryへprovider response全文、prompt、private reasoningを自動commitしない。
