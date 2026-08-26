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
- `SemanticRequest`: このstageで何をAIへ依頼するか
- `ExecutionProfile`: どのprovider / model / budgetで実行するか
- `SemanticResponse`: provider-neutral response
- deterministic importer: schema / lineage / policy validationとartifact publication

## SemanticRequestEnvelope

```ts
interface SemanticRequestEnvelope {
  schemaVersion: 1;
  requestId: string;
  jobId: string;
  jobFingerprint: string;
  stage:
    | "evidence"
    | "author"
    | "content_audit"
    | "revision"
    | "visual_plan"
    | "visual_audit";

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
    externalFactPolicy: "fixed_sources_only";
  };

  requestSha256: string;
}
```

AI runnerは`requestSha256`をresponseへechoし、importerが完全一致を検査する。

## ExecutionProfile

provider selectionはversion-controlled profileが所有する。

```ts
interface AIExecutionProfile {
  schemaVersion: 1;
  id: string;

  stageBindings: Partial<Record<SemanticStage, ProviderProfileId>>;

  budgets: {
    maxCallsPerStage: number;
    maxTotalCallsPerJob: number;
    timeoutSeconds: number;
  };
}
```

## ProviderProfile

```ts
interface ProviderProfile {
  id: string;
  capability: "text" | "vision" | "image" | "search";
  provider: string;
  model: string;
  snapshot?: string;
  transport: string;
  optionsProfileId?: string;
}
```

provider固有parameterの全種類をdomain schemaへ押し込まない。provider adapterのtyped options profileが所有する。

secret / API keyはprofileへ保存しない。

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
    executionProfileId: string;
    startedAt: string;
    finishedAt: string;
    externalApiUsed: boolean;
    warnings: string[];
  };
}
```

model identityはprovider-neutral lineageであり、provider内部実行を暗号学的に証明するものではない。

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
- authorのself-evaluationを正解とするfield

必要なtarget artifactとfixed evidenceだけを渡す。

## Search backend

source discoveryにAI searchを利用する場合も、search resultそのものをevidenceとしない。

`SourceDiscoveryBackend`はcandidate locatorを返し、deterministic source acquisition / pinning stageがactual source identityを確定する。

## Retry

schema failure / transient provider failureのretryは有限回。

retry時にresponse contractを弱めない。budget exhaustionは`BLOCKED`。

## Storage

request / response / runner lineageはprivate Article Job workspaceへ保存する。

public repositoryへprovider response全文を自動commitしない。
