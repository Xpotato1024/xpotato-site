---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - external AI input disclosure admission
  - private source disclosure boundary
  - external semantic vision and image request admission
---

# External AI Disclosure Contract

## Purpose

`externalTextAI=true` / `externalImageAI=true` は「外部AI providerを利用してよい」というjob-level capability上限であり、**任意のsource/artifact bytesを外部providerへ送ってよいという許可ではない**。

publication/citation safetyとexternal processing disclosureを分離し、各external requestへ投入するexact artifact setをdeterministicにadmitする。

```text
source/artifact acquired locally
        |
        +--> publication/citation policy
        |
        +--> external-AI disclosure policy
                     |
                     v
           disclosure record / derived artifact
                     |
                     v
           request disclosure manifest
                     |
                     v
              external provider
```

## Separate semantics

次は互いに代用しない。

- `publicSafe`: Git/public provenanceへ安全に表現できるか
- `citation.eligible`: reader-facing citationとして公開できるか
- `trustClass`: source authority class
- `externalAiDisclosure`: exact bytes/derived bytesをexternal AIへ送れるか

たとえばprivate user logはcitation不可でも、userが明示許可したredacted derivativeだけをexternal AIへ送れる場合がある。

## Default-deny rule

External provider input admissionはdefault deny。

- public Web/official/repository sourceも、configured system/repository policyで明示allowされるまでimplicit allowにしない
- user/local/private artifactはexplicit user/repository authorizationなしにraw disclosureしない
- unknown disclosure stateは`deny`
- broad `externalTextAI=true` / `externalImageAI=true`でdenyを上書きしない

## Hard-deny material

次のactual secret-bearing bytesはexternal AI inputとして**常にdeny**し、ordinary user confirmationでoverrideしない。

例:

- API keys / passwords / private keys
- session cookies / Authorization headers
- MFA/recovery codes
- signed/ephemeral URLs containing capability-bearing secrets
- provider/service credentials
- decrypted secret files

必要なfactがある場合、secret valueそのものを含まないlocally-derived statement/artifactを作る。

Secret detectionはperfectではないため、known-secret source class / deterministic secret scan / explicit policyを組み合わせる。

## Disclosure modes

```ts
type ExternalAiDisclosureMode =
  | "allow_exact"
  | "allow_derived_only"
  | "deny";

type ExternalAiDisclosureBasis =
  | "system_policy"
  | "repository_policy"
  | "user_authorized";

interface ExternalAiDisclosureRecord {
  schemaVersion: 1;

  subject: {
    kind: "source" | "artifact";
    id: string;
    sha256: string;
  };

  mode: ExternalAiDisclosureMode;
  basis: ExternalAiDisclosureBasis;
  policyId: string;
  policySha256: string;

  authorizedBy?: "user" | "repository_policy" | "system_policy";
  authorizedAt?: string;

  derivedArtifactPolicyId?: string;
  notes: string[];
}
```

### `allow_exact`

Exact subject bytes may be sent to an external AI provider, after request-time secret/private exclusion validation。

### `allow_derived_only`

Raw subject bytes may **not** be sent externally。

A deterministic/local derivation step produces a separate artifact, for example:

- redacted excerpt
- credential-free log excerpt
- locally summarized structured facts
- cropped/redacted screenshot
- metadata-stripped image

The derived artifact has its own SHA and its own disclosure record. External request references only the derived artifact。

### `deny`

Neither raw subject nor a derivative is externally admitted unless a later explicit authorization creates a **new disclosure record**. Do not mutate historical admission records in-place。

## Source defaults

Initial policy candidates:

| Source class | Initial disclosure behavior |
|---|---|
| public official/web source fetched from public URL | repository/system policy may `allow_exact` after credential/signed-URL checks |
| public GitHub/repository content | repository/system policy may `allow_exact` when exact revision is intended public input |
| user note/log/local file | `deny` by default; user may authorize exact or derived-only |
| private repository/document | `deny` by default; explicit repository/user policy required |
| raw camera/user image | `deny` by default; explicit image disclosure or safe local derivative required |
| secret-bearing artifact | hard `deny` |

Exact repository policy is version-controlled and cannot be invented by a semantic Skill。

## Job-level authorization

`ArticleJobSpec` contains provider-use upper bounds and a disclosure policy binding:

```ts
interface ExternalAiInputPolicyBinding {
  policyId: string;
  policySha256: string;
}
```

Job initialization may additionally accept explicit user disclosure authorizations for named supplied inputs. These authorizations are normalized into `ExternalAiDisclosureRecord`s after the actual input/source bytes are identified and hashed。

A free-form note such as “AI can use my logs” is not directly forwarded as a provider permission; executor converts explicit user intent into typed records bound to exact artifact identity。

## Request disclosure manifest

Every **external** text/vision/image-generation request must bind an exact disclosure manifest。

```ts
interface ExternalAiDisclosureManifest {
  schemaVersion: 1;
  jobId: string;
  jobFingerprint: string;
  requestId: string;
  stage:
    | "source_discovery"
    | "evidence"
    | "author"
    | "content_audit"
    | "revision"
    | "visual_plan"
    | "visual_audit"
    | "image_generation";

  policyId: string;
  policySha256: string;

  entries: Array<{
    requestArtifactId: string;
    requestArtifactSha256: string;
    disclosureRecordSha256: string;
    sourceSubjectSha256?: string;
    modeUsed: "exact" | "derived";
  }>;

  secretScanResultSha256: string;
  manifestSha256: string;
}
```

## Exact-set admission rule

Before provider call:

1. construct the exact physical/serialized request input artifact set;
2. resolve every external input to a current disclosure record;
3. for derived-only source, prove request artifact is the admitted derivative, not raw source;
4. reject any `deny`, unknown, stale, hash-mismatched, secret-bearing input;
5. run deterministic secret/private exclusion checks on final serialized request;
6. require manifest entry set = actual provider input artifact set;
7. bind `manifestSha256` into the provider request/run lineage;
8. only then call provider。

Semantic AI/Skill/provider cannot self-authorize or broaden the manifest。

## Stage behavior when required evidence is denied

Do **not** silently omit required denied evidence and continue as if complete。

Allowed paths:

1. create a safe locally-derived artifact if policy permits `allow_derived_only`;
2. use an explicitly configured local/non-external backend;
3. ask for explicit user/repository authorization when appropriate;
4. narrow/remove the dependent claim;
5. transition `BLOCKED` with a disclosure limitation。

The output/audit must retain the limitation when unavailable private evidence affects completeness。

## Image / vision handling

The same admission semantics apply to bytes sent for:

- vision-based visual audit
- image-generation prompt/context inputs
- source image editing/reference

Raw user photos/screenshots/private images are not externally sent merely because `externalImageAI=true`。

If an image must be normalized/redacted locally first, only the exact derived admitted image is sent and hashed in the disclosure manifest。

## SourceRecord relationship

Each source used by Article Job must resolve a disclosure record independently from `publicSafe`/citation metadata。

Conceptual field:

```ts
externalAiDisclosureRef: string;
```

The SourceRecord does not duplicate provider policy details; the ref resolves the versioned disclosure record。

## SemanticRequest / image request binding

External `SemanticRequestEnvelope` and external image-generation request must include:

```ts
externalAiDisclosureManifestSha256: string;
```

Local/non-external runs use a deterministic `not_external` representation and must not pretend an external admission occurred。

## Durable lineage

Long-term Publication Provenance need not retain private disclosure records or source bodies。

It may retain safe policy/run lineage such as:

- disclosure policy ID/hash
- request disclosure manifest hash
- whether exact/derived external input was used

Do not export private artifact paths, private excerpts, authorization comments containing secrets, or raw disclosure manifests when they reveal private source inventory unnecessarily。

## Skill boundary

Semantic Skills may:

- identify that required information is unavailable under current disclosure policy
- propose redaction/derived evidence needs

Semantic Skills may not:

- change `deny` to `allow`
- claim user authorization
- mark secret-bearing content safe
- construct provider inputs outside deterministic admission

## Validation

Contract/PR fixtures:

- unknown disclosure -> deny
- `externalTextAI=true` with denied input still blocks provider call
- `publicSafe=true` does not imply external disclosure
- citation eligibility does not imply external disclosure
- private user log exact disclosure requires explicit authorization
- derived-only source proves raw bytes absent from final request
- hard-deny secret cannot be overridden by broad job permission
- final serialized request artifact set exactly equals manifest entry set
- changed artifact hash makes admission stale
- visual/image request follows same admission rule
- required denied evidence cannot be silently omitted
- durable provenance contains policy/hash lineage without private source body
