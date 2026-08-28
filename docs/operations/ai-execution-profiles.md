---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - initial Article Job AI provider/model profile
  - initial semantic AI resource budget
  - AI escalation policy
---

# Article Job AI Execution Profiles

## Purpose

Article Job architectureはprovider-neutralだが、initial implementationには再現可能なdefault profileが必要。

2026-08-26時点のinitial adapterとしてOpenAI Responses API / GPT-5.6 family / GPT-Image-2を採用する。

model/versionはsite content contractではなくversioned execution profileなので、provider/model差替えでMDX/content schemaを変更しない。

## Initial profile ID

```text
article-ai-openai-v1
```

## Semantic stage bindings

| Stage | Default model | Reasoning effort | Tool use | Rationale |
|---|---|---|---|---|
| source_discovery | `gpt-5.6-terra` | medium | web search allowed | broad discoveryはcost/quality balanceを優先 |
| evidence | `gpt-5.6-terra` | high | fixed source artifacts only | atomic evidence/ambiguity extraction |
| author | `gpt-5.6-sol` | high | fixed source artifacts only | article quality / synthesis / Japanese structure |
| content_audit | `gpt-5.6-sol` | high | fixed source artifacts only | fabrication/evidence gap検出を最優先 |
| revision | `gpt-5.6-terra` | high | fixed source artifacts only | bounded findings修正にfrontier maximumを常用しない |
| visual_plan | `gpt-5.6-terra` | medium | fixed article/evidence only | semantic concept / forbidden depiction / composition planning |
| visual_audit | `gpt-5.6-terra` | high | image input + fixed article plan | visual correctness/security review |

`gpt-5.6` aliasではなくexplicit `gpt-5.6-sol` / `gpt-5.6-terra`をprofileへ保存する。

providerがdated text snapshotを提供する場合はfuture profileでsnapshotへpinする。現時点でdated snapshotが公開されていないmodelはmodel ID + request/response hash + provider run metadataをlineageに残す。

## Image generation profile

```text
provider: OpenAI
model: gpt-image-2
snapshot: gpt-image-2-2026-04-21
```

initial hero generation:

- landscape source size: `1536x1024` candidate
- quality: `medium`
- one image per generation attempt
- generated text/logo/UIをprompt上で原則禁止
- article title textはimage modelで描かずsocial-card renderer側
- crop-safe compositionをvisual planで要求

mediumをinitial defaultとし、visual audit failureを「常にhighへ上げる」ことで解決しない。

high qualityが必要なvisual classはstyle/eval evidence後にseparate profileを作る。

## Escalation profile

```text
article-ai-escalation-v1
```

### Terra -> Sol escalation allowed

source_discovery/evidence/revision/visual_auditで次の場合だけSolへ再実行可能:

- material source contradictionがTerraで解消不能
- strict schema contract retry後もsemantic ambiguityが残る
- P0/P1判定が低confidenceでpublication outcomeに影響
- visual auditでfake factual depiction / rights / safety判断がambiguous

### Escalation does not mean approval

Sol結果でも:

- deterministic import
- independent audit where applicable
- human approval

を迂回しない。

### No Luna in correctness-critical semantic stages initially

`gpt-5.6-luna`はinitial production Article Jobのmaterial semantic stageには使用しない。

将来:

- metadata normalization
- low-risk classification
- high-volume non-material helper

でevalが十分なら別profileで導入できる。

## Initial budget profile

```text
article-budget-standard-v1
```

### Stage invocation budgets

| Stage | Max semantic invocations | Notes |
|---|---:|---|
| source_discovery | 2 | initial + one bounded expansion/escalation |
| evidence | 2 | initial + contract/escalation candidate |
| author | 2 | normal 1; second only contract/provider failure |
| content_audit | 3 | initial + up to 2 post-revision audits |
| revision | 2 | automatic semantic revision cycles hard max |
| visual_plan | 2 | initial + one bounded correction/escalation |
| visual_audit | 2 | initial + one post-regeneration/escalation |

hard semantic total:

```text
maxTotalSemanticInvocations = 15
```

transport retryはsemantic invocationとは別counter。

### Search budget

```text
maxSearchToolCalls = 10
```

source discovererが10回を使い切ってもsource qualityが不足する場合は自動で検索範囲を無限拡張せず`BLOCKED`/human review候補。

### Image budget

```text
maxImageGenerationAttempts = 2
```

1枚生成 -> visual audit -> reject時のみ最大1回regenerate。

2回ともP0/P1 visual blockerならdeterministic coverへfallback可能。記事公開をimage provider loopへ依存させない。

### Revision budget

```text
maxSemanticRevisionCycles = 2
```

2回後にP0/P1が残るなら`BLOCKED`。

### Transport retry

```text
maxTransientRetriesPerInvocation = 1
```

1 initial + 1 transient retryまで。

rate limit/5xx等でbackoffするが、timeoutを延々増やさない。

### Timeouts

initial implementation target:

```text
textTimeoutSeconds = 240
imageTimeoutSeconds = 360
```

local CLI cancellationをsupportし、timeout時にpartial semantic responseをcanonical artifactへ昇格しない。

## Output/token budgets

provider token上限をarticleごとの自由入力にしない。

stage-specific output cap candidate:

- discovery/evidence/audit/visual plan: structured output中心でtight cap
- author/revision: article length requirementからderived cap

exact token countsはimplementation evalでmachine configに置く。

Article authorが長文だからという理由で1M context全体を無条件投入しない。

source bundleはclaim relevanceで選別し、input artifact hashを保持する。

## Cost guard

costをcorrectness gateにしないが、unbounded agent spendingも許可しない。

job manifestへprovider usage metadataが取得可能なら:

- input tokens
- cached input tokens
- output tokens
- search/tool usage
- image attempts

をprivate usage ledgerへ記録する。

価格表そのものは頻繁に変わるためrepository architecture SoTへ金額を固定しない。

optional local warning budgetはprovider pricing configから計算できる。

## Provider failure fallback

### Text/vision provider unavailable

material semantic stageを別modelでsilent substitutionしない。

allowed:

- same approved execution profile retry
- versioned fallback profile if explicitly configured and eval済み
- BLOCKED

### Image provider unavailable

Blog heroはdeterministic coverへfallback可能。

image generation outageでcontent publicationを永久blockしない。

## Secrets

OpenAI API keyは:

- execution profileへ保存しない
- Article Job artifactへ保存しない
- semantic promptへ含めない

provider adapterがruntime secret injectionだけを受け取る。

## Eval before promotion

implementation時にgolden Article Job fixturesで少なくとも:

- source precision/recall
- evidence proposition correctness
- author citation discipline
- P0/P1 audit detection
- revision regression
- visual fake-UI/metric detection
- structured output adherence
- average stage calls / budget exhaustion frequency

を比較する。

current model releaseだけを理由にprofileを自動更新しない。

## Current provider references

- GPT-5.6 model guidance: https://developers.openai.com/api/docs/guides/latest-model
- GPT-5.6 Sol: https://developers.openai.com/api/docs/models/gpt-5.6-sol
- GPT-5.6 Terra: https://developers.openai.com/api/docs/models/gpt-5.6-terra
- GPT-Image-2: https://developers.openai.com/api/docs/models/gpt-image-2
