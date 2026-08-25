---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - AI-first article authoring product context
  - human and AI responsibility boundary
---

# AI-first Article Authoring Context

## Product assumption

vNext の Blog publishing は **AI-first** を標準とする。

通常の記事では、人間が最初から完成原稿を書くことを前提にしない。人間は topic、目的、reader、手元の evidence / notes / media、公開条件を与え、AI pipeline が source discovery、evidence 整理、初稿、visual planning、監査、revision candidate を生成する。

ただし AI-first は autonomous publishing を意味しない。

- AI は semantic proposal を生成する。
- deterministic executor が request / response / artifact を検証する。
- canonical repository write と state transition は executor が所有する。
- final article / hero / metadata は人間が preview を確認して approval した exact candidate からのみ export する。

## Human role

通常の人間作業を次へ寄せる。

1. topic / intent / reader outcome を与える。
2. private / public、external API、画像生成等の permission を決める。
3. 手元の notes、GitHub repository、log、photo 等があれば input として渡す。
4. pipeline が作った preview と unresolved item を確認する。
5. exact candidate を approve / reject / request-change する。

記事本文の全段落を人間がゼロから書くことを通常 workflow の必須作業にしない。

## AI role separation

単一 agent に「検索、記事生成、画像生成、自己監査、repository write、publish」を一括委譲しない。

semantic role を分離する。

- source discoverer
- evidence analyst
- article author
- independent content auditor
- bounded reviser
- visual planner
- visual auditor

image generator 自体は semantic role ではなく provider adapter として扱い、固定された visual request から bytes を生成する。

## Article is not the only artifact

AI-first publishing では、完成 MDX だけを残すと「なぜその主張・画像になったか」を追跡できない。

Article Job は少なくとも次を別 artifact として持つ。

- job specification
- source manifest
- evidence / ambiguity ledger
- author request / response
- versioned draft
- claim ledger
- taxonomy / metadata proposal
- visual plan
- image generation record where applicable
- independent audit findings
- candidate manifest
- preview validation record
- human approval record

public repository へすべてを commit する必要はない。full job workspace は private、final public content と必要最小限の publication provenance は repository とする。

## Hero image product requirement

Blog article は publish candidate の時点で hero visual を持つことを原則とする。

source material に有用な写真・スクリーンショット等がない software article でも、hero 欠落を通常状態にしない。

hero strategy の優先順位:

1. **source / real media** — 記事内容を実際に示し、公開可能な画像がある。
2. **AI conceptual illustration** — 実画像がなく、概念的 visual が適切。
3. **deterministic design-system cover** — image generation が不許可、失敗、または不適切。

AI image generation の失敗を article publishing 全体の single point of failure にしない。

## Generated visual is not evidence

AI-generated hero は article の説明・雰囲気・概念を視覚化する装飾 / explanatory artifact であり、実測 evidence として扱わない。

特に software / infrastructure article では、生成 hero に次を事実として描かせない。

- 存在しない UI screenshot
- 実行していない terminal output
- 実在しない code / config
- 未観測 benchmark chart / number
- 実機を撮影したように見える hardware state
- source に存在しない logo / product endorsement

actual UI / terminal / graph が必要なら source screenshot または deterministic diagram / chart を使う。

## Hero and social card separation

hero visual と OGP / social card は同じ artifact である必要はない。

推奨モデル:

```text
real / generated / deterministic hero visual
                  |
                  v
       deterministic social-card renderer
                  |
        title / category / site brand
                  v
             OGP image
```

画像モデルに記事タイトルを raster text として描かせない。title は HTML / metadata を正本とし、social card に文字を入れる場合は site-owned renderer が deterministic に合成する。

## Trust and provenance

AI-generated visual は machine-readable provenance を持つ。

最低限:

- `origin = ai_generated`
- provider / model / snapshot or version identity
- visual profile version
- request / prompt hash
- generated raw bytes hash
- normalized public derivative hash
- article / evidence bundle hash
- generation time
- audit / moderation result

prompt text や private source を public metadata にそのまま露出することは要求しない。

public UI 上の generated-image disclosure は product decision として明示的に選ぶ。少なくとも内部では origin を失わない。

## Success criteria

- topic と許可済み input から HUMAN_REVIEW_READY まで一貫した Article Job を実行できる。
- AI が canonical `src/content/` を直接更新しない。
- draft の material claim を source / evidence へ追跡できる。
- content audit は author context と独立して実行できる。
- Blog candidate は hero visual を必ず持つ。
- software article で適切な real hero がなければ generated conceptual hero を作れる。
- image API が使えなくても deterministic cover へ fallback できる。
- human approval は exact article + metadata + hero + asset candidate hash に bind される。
