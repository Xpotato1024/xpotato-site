---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - initial external AI disclosure policy profile
  - initial Article Job external input admission defaults
---

# External AI Disclosure Profile v1

## Purpose

ADR-0026 / `contracts/external-ai-disclosure-contract.md` define the trust semantics。This document fixes the **initial launch policy instance** so an implementation does not invent different defaults while still remaining fail-closed。

Profile ID:

```text
article-external-ai-disclosure-v1
```

Implementation machine SoT target:

```text
packages/content-contracts/src/profiles/external-ai-disclosure-v1.ts
```

Generated schema/fixture hashes and the policy file bytes determine `policySha256`。

This profile is provider-neutral。Changing OpenAI/model/provider does not silently change disclosure scope。

## Global rules

1. provider-use permission and input disclosure are independent;
2. unknown/unclassified input -> `deny`;
3. actual secret/capability-bearing material -> hard `deny`;
4. public-source admission is based on an independently verified public acquisition class, not `publicSafe`/citation/trust flags;
5. user/local/private inputs require explicit exact or derived-only authorization;
6. every external request is exact-set admitted after final request serialization;
7. denied required evidence is not silently omitted;
8. no semantic Skill/provider may broaden this policy。

## Input admission classes

The deterministic executor assigns one of these admission classes after materializing/hash-identifying the source/artifact。The class is not an AI output。

### `public_anonymous_web_v1`

Eligibility:

- source was acquired from an anonymous/public HTTPS endpoint;
- acquisition required no cookie, auth header, client certificate, private network, or user credential;
- canonical/final URL contains no capability-bearing signed/ephemeral secret;
- final acquired bytes pass deterministic secret/private exclusion checks applicable to the request;
- source is intended as external research material rather than user-private input merely exposed at a URL。

Initial mode:

```text
allow_exact
```

The exact acquired/snapshot artifact is admitted; search snippet alone is not substituted for source identity。

### `public_github_revision_v1`

Eligibility:

- GitHub repository/revision is independently verified public/anonymous-readable;
- exact commit/blob identity is pinned;
- no repository credential/private attachment is needed;
- selected file/artifact passes final secret scan。

Initial mode:

```text
allow_exact
```

A repository being accessible through the user's connected/private credentials does **not** qualify as this class merely because GitHub returned it。

### `article_job_brief_v1`

Article topic/requirements are user-authored intent, not automatically public data before publication。

The request compiler creates a separate bounded `ArticleJobBrief` artifact containing only the fields selected for the semantic stage, for example:

- target collection
- working title/topic
- reader outcome / assumed knowledge
- article mode
- required/forbidden claim intents
- required/forbidden section intents
- non-secret taxonomy hints
- non-secret visual requirement summary

It excludes:

- user note bodies
- local/private source bodies
- repository file contents
- credentials/signed URLs
- private absolute paths
- raw image bytes

Initial mode:

```text
deny until explicit user authorization
```

Normal external-AI job initialization therefore includes a clear human admission action for the exact `ArticleJobBrief` artifact。A UI/CLI may combine this with provider-use confirmation, but the resulting records remain two typed permissions and the brief SHA is fixed before the provider call。

### `user_note_or_log_v1`

Includes user notes, logs, copied text, local files, private operational evidence。

Initial mode:

```text
deny
```

User may explicitly authorize:

- `allow_exact`; or
- `allow_derived_only`。

Recommended default UX for logs/private operational evidence is derived-only where a local redaction/structured-fact extractor can satisfy the task。

### `private_repository_or_document_v1`

Includes private Git repositories, private Drive/file-library material, authenticated documentation, internal/private files。

Initial mode:

```text
deny
```

Explicit repository policy or user authorization may permit exact/derived-only use except hard-deny secret material。

No rule such as “user connected the repository, therefore external AI may receive it” is permitted。

### `raw_user_image_v1`

Includes camera photo, screenshot, scan, private diagram/source image before local privacy processing。

Initial mode:

```text
deny
```

When external vision/image processing is desired, normal preferred path is:

1. explicit user authorization for derived-only disclosure;
2. local orientation/metadata stripping/redaction/crop as needed;
3. create a new derived image artifact;
4. create disclosure record for that exact derivative;
5. external request references derivative only。

`externalImageAI=true` never changes this default。

### `approved_publication_derivative_v1`

A privacy-normalized/generated artifact that has already passed the relevant local publication/privacy boundary can be admitted by repository/system policy **only if** its exact purpose/source lineage is compatible with the current external stage and it contains no hard-deny material。

Initial mode:

```text
allow_exact
```

Examples can include a metadata-stripped canonical image intended for external visual audit, but this class is not inferred from file format alone。

### `secret_or_capability_material_v1`

Includes actual values of:

- passwords/API tokens/private keys
- session cookies/Authorization headers
- MFA/recovery codes
- decrypted secret files
- signed/ephemeral URLs where possession grants capability
- service/provider credentials

Mode:

```text
hard deny
```

No ordinary user/job/repository policy override。

## Seed URLs / URLs in text

Before including a URL in an external request:

- strip no semantics automatically;
- classify whether it is anonymous public locator or capability-bearing/private locator;
- capability-bearing URL -> hard deny as raw value;
- if only non-secret hostname/path semantics are required, create a local safe derived representation with a new hash/disclosure record。

## Source discovery

External source discovery normally receives:

- an explicitly user-authorized `ArticleJobBrief`;
- explicitly admitted public seed locators/derived seed representations;
- no user note/private repository/raw image body unless separately authorized。

Search results returned by the provider are **candidate locators only**。They are acquired/pinned locally and independently classified before use in later external evidence/author/audit stages。

## Evidence / author / audit / revision

Each stage gets a fresh request disclosure manifest based on the actual stage artifacts。

A SourceRecord being fixed/validated does not mean the source bytes are admitted externally。

When detailed evidence is built locally from a disclosure-denied source, later external author/auditor stages may receive only:

- an explicitly admitted public-safe derived evidence artifact; or
- no such evidence, with limitation/BLOCKED handling according to the contract。

## Visual planning / visual audit / image generation

- article brief/text context: separately admitted artifact;
- reference/source image: separately admitted exact/derived artifact;
- prompt derived from private source: the compiled prompt itself is an artifact and must be admitted;
- raw user image default deny;
- normalized/redacted derivative may be admitted after exact lineage validation。

## Secret scan boundary

A disclosure record is necessary but not sufficient。Immediately before transport, the **final serialized/provider input** is scanned/validated again。

If a hard-deny secret is detected:

- provider call is blocked;
- prior allow record is not treated as sufficient;
- a safe local derivative/new admission is required if work should continue。

## Policy/hash lineage

Every external request/run stores privately:

- policy ID/hash
- disclosure record hashes
- disclosure manifest hash
- final scan result hash
- exact request hash

Durable Publication Provenance stores only safe required lineage:

- policy ID/hash
- manifest hash
- exact/derived/mixed mode summary

not private source bodies/paths/full disclosure inventory。

## Change control

Material changes to:

- default public/private admission classes;
- hard-deny scope;
- automatic public-source admission;
- user-authorization semantics;
- derived-only guarantee;

require ADR-0026-compatible material review and a new profile version, e.g. `article-external-ai-disclosure-v2`。

Changing a model/provider alone does not change this policy ID。

## Validation fixtures

At implementation, machine profile must cover at least:

1. anonymous public official doc -> exact admitted;
2. anonymous public GitHub pinned file -> exact admitted;
3. connected/private GitHub file -> deny absent separate authorization;
4. ArticleJobBrief -> deny until exact user authorization;
5. user log -> deny;
6. user log -> derived-only redacted artifact; raw bytes absent;
7. raw camera screenshot -> deny;
8. authorized normalized/redacted image derivative -> admitted;
9. signed URL -> hard deny raw locator;
10. API token embedded in otherwise allowed artifact -> final scan blocks call;
11. manifest input set mismatch -> block;
12. changed artifact hash -> stale admission;
13. required denied evidence -> limitation/BLOCKED, not silent omission。
