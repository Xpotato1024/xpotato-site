---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - media publication authorization semantics
  - attribution and rights metadata
---

# Media Publication Rights Contract

## Problem

Article Jobのsource discoveryやvisual planningはWeb上の画像・screenshot・diagramを認識できるが、**参照できることと再配布できることは別**である。

AIが見つけたexternal imageを、権利確認なしにR2へcopyしてhero/inline assetとして公開するworkflowを禁止する。

## Principle

public R2へpublishする全media assetは、bytes provenanceとは別に**publication rights basis**を持つ。

semantic AIはrights approvalを自己生成できない。

## RightsBasis

```ts
type RightsBasis =
  | "self_created"
  | "ai_generated_authorized"
  | "licensed"
  | "public_domain"
  | "permission_granted"
  | "limited_excerpt"
  | "unknown";
```

`unknown`はpublic publication不可。

## MediaRightsRecord

```ts
interface MediaRightsRecord {
  schemaVersion: 1;
  rightsId: string;

  basis: RightsBasis;
  publicationAuthorized: boolean;

  ownerOrSource?: string;
  sourceUrl?: string;
  licenseId?: string;
  licenseUrl?: string;
  attributionText?: string;

  scope?: {
    commercialUse?: boolean | "unknown";
    modification?: boolean | "unknown";
    redistribution?: boolean | "unknown";
  };

  confirmedBy:
    | "system_policy"
    | "user"
    | "migration_review";

  confirmedAt: string;
  notes?: string[];
}
```

legal conclusionをAIに委譲する意味ではない。既知のbasis / user declaration / configured policyをmachine-readableに保持するためのrecord。

## Common cases

### User/iPhone camera photo

userが自身で撮影し公開するmedia:

```text
basis = self_created
publicationAuthorized = true
confirmedBy = user or configured author policy
```

人物・第三者private information等のprivacy/publication-safety reviewはrightsとは別に必要。

### AI-generated hero

authorized image-generation providerでArticle Jobが生成したvisual:

```text
basis = ai_generated_authorized
publicationAuthorized = true
```

provider usage terms / account authorization等はexecution profile / current service agreementに依存し、model response自身をrights approvalとしない。

### Repository-owned deterministic diagram

site/article sourceから生成したdiagramは通常`self_created`。

### Licensed/public-domain media

license/source metadata required。

license条件がattributionを要求する場合、Media Registry / Figure rendererが表示できるmachine metadataを持つ。

### Screenshot

screenshotは`self_created`と自動分類しない。

写っているthird-party UI/contentのpublication basisはcontext-dependent。

Article Jobがscreenshotをpublic factual visualとして使う場合、rights/publication authorizationを人間または明示policyで確認する。

### Web source image

source discoveryで取得したpublic web imageは**default `unknown`**。

引用元URLがあるだけで再配布許可とはみなさない。

通常は:

- image自体を転載せずsourceへlink
- factual contentを自作diagramにする
- authorized screenshot/source mediaをuserが提供
- AI conceptual heroを生成

を優先する。

## `limited_excerpt`

記事上の説明・批評等で限定的なthird-party visual excerptを扱う場合のescape hatch。

このbasisは自動AI判定で有効化しない。

user/legal/editorial reviewによりpublicationAuthorized=trueが明示された場合のみ。

## Media Registry binding

`MediaAssetRecord`は`rightsRef` required。

public media publication prerequisite:

- rights record exists
- `publicationAuthorized=true`
- `basis != unknown`
- required attribution metadata complete

## Attribution rendering

attribution required assetは:

- Figure caption/credit
- Gallery item credit
- dedicated source note

等、content contextに合うrendererで表示する。

hero/social cardのattribution表示要件はrights record/license条件を満たす別UI policyを必要とする。表示できないlicense assetをheroへ選ばない。

## Article Job

### Visual planning

plannerはexternal web imageを`source_media`候補へ自動昇格させない。

source-media strategyは:

- supplied media
- repository-owned media
- already rights-authorized media catalog

を優先する。

unknown-rights mediaが必要なら`BLOCKED / user review required`として出す。

### Media publication

R2 publisherはrights semanticsを推測しない。

MediaPublicationRequest作成前にdeterministic validationでrightsRefを確認する。

## Migration

legacy public mediaは「既に公開されていた」だけで権利basisが証明されたとは限らない。

migration inventoryで:

- self-created known
- generated/owned known
- third-party/unknown

を分類できる。

material unknownがあればmigration review対象。

## Provenance versus rights

- provenance: どのbytes/producer/sourceから来たか
- rights: public redistributionが許可されたbasis

を別recordにする。

AI-generated provenanceが完全でもrights recordがなければpublishしない。

## Validation

- every public MediaAssetRecord has rightsRef
- rightsRef resolves
- publicationAuthorized true
- basis != unknown
- attribution-required record has complete attribution metadata
- external discovered image cannot become publishable without explicit rights record
- screenshot not auto-classified self-created solely because user captured it
