---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0026: external AI inputはartifact単位で明示admissionする

## Context

Article Jobはpublic Web sourceだけでなく、user note、private log、local file、repository content、screenshot/photo等を入力にできる。

Job-levelの`externalTextAI=true` / `externalImageAI=true`だけでprovider useを許可すると、次の2つを区別できない。

1. external AI provider自体を利用してよいか;
2. particular source/artifact bytesをそのproviderへ送ってよいか。

また`publicSafe`/citation eligibilityはGit/publication representationの安全性であり、external processing disclosureとは別semanticである。

この区別がないと、private logを意図せずproviderへ送るか、逆にhumanが明示許可したprivate inputを使えないかのどちらかになる。

## Decision

External AI inputは**artifact/source単位のexplicit admission**を要求する。

### Separate permissions

- job-level external AI permission = provider capability upper bound
- per-source/artifact disclosure record = bytes admission authority

Broad job permission alone never admits a particular input。

### Default deny

Unknown/private input disclosureはdefault deny。

Public sourceもrepository/system policyで明示admitされた場合に利用する。Agent/Skillが「公開URLだから送ってよい」と自己判断しない。

### Disclosure modes

- `allow_exact`
- `allow_derived_only`
- `deny`

`allow_derived_only`ではraw inputを送らず、local deterministic redaction/summary/crop等で作った別artifactだけをexternal requestへ入れる。

### Hard deny secrets

credential/password/private key/session cookie/Authorization header/MFA/recovery code/capability-bearing signed URL等のactual secret bytesはbroad human/job permissionでもexternal providerへ送らない。

必要な意味だけをsecret-free local derivativeへ落とす。

### Request-level exact manifest

Every external semantic/vision/image-generation request binds a deterministic `ExternalAiDisclosureManifest`。

Manifest entry set must exactly equal the actual request input artifact set。Provider call前に:

- policy/ref/hash
- exact vs derived mode
- final serialized request secret scan
- denied/stale/unknown absence

をvalidateする。

### Required denied source

Required evidenceがdisclosure-deniedの場合、silent omissionしてcomplete resultを生成しない。

Allowed outcomes:

- admitted safe derivative
- local/non-external backend
- explicit authorization request
- claim narrowing/removal
- `BLOCKED` + limitation

## Why not reuse `publicSafe`

Public representation safety and external processor disclosure have different threat models。

Private source may be externally admitted but never public-citable; public-safe metadata may describe a source while raw bytes remain external-AI denied。

Therefore one boolean cannot represent both without ambiguity。

## Alternatives

### `externalTextAI=true` means all job inputs may be sent

simple but private-data disclosure blast radius is unacceptable。

### Treat all private/non-public source as permanently external-AI denied

safe but unnecessarily prevents explicitly authorized private-log/repository-assisted authoring。

### Let the AI decide what is sensitive

untrusted semantic output would control its own data-access boundary, so rejected。

### Ask human every provider call

secure but authoring friction is excessive. Exact typed authorization/policy records make repeated calls deterministic while keeping explicit control。

## Consequences

Positive:

- private/public publication semantics no longer leak into provider-disclosure semantics;
- broad provider permission cannot silently disclose private inputs;
- explicitly authorized private workflows remain possible;
- request lineage proves what exact/derived artifacts were admitted;
- same mechanism covers text, vision, and image-generation context。

Costs:

- Source/artifact admission records and request manifests are required;
- local redaction/derivation tooling may be needed;
- some jobs block instead of silently dropping private evidence。

These costs are accepted because a reproducible AI-first publishing workflow needs an explicit information-disclosure trust boundary。

## Revisit triggers

- external AI provider changes its data-processing boundary materially;
- a trusted fully-local semantic backend becomes the default;
- repository-wide private source classification requires richer policy groups;
- redaction/derived artifact policy becomes complex enough for a separate data-loss-prevention subsystem。

## Related

- `../../contracts/external-ai-disclosure-contract.md`
- `../../contracts/article-job-contract.md`
- `../../contracts/ai-exchange-execution-contract.md`
- `../../architecture/security-privacy-policy.md`
- `../../architecture/ai-content-operating-model.md`
