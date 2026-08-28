---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - AI-generated article media policy
  - generated hero provenance and disclosure
---

# Synthetic Media Policy

## Scope

この文書は Article Job が生成する hero / decorative illustration を扱う。

chart、benchmark graph、UI screenshot、terminal screenshot、hardware photo 等の factual evidence visual を AI-generated decorative image と混同しない。

## Hero requirement

Blog publish candidate は原則として hero visual 必須。

strategy:

1. suitable source media
2. AI conceptual illustration
3. deterministic design-system cover

Notes / Pages 等の hero requirement は collection policy で別に定義できる。

## Conceptual, not fabricated evidence

AI-generated hero の役割は article concept の視覚的要約 / atmosphere である。

禁止 default:

- readable fake source code
- fake terminal / log output
- fake application screenshot
- fake benchmark / chart / metric
- factual-looking architecture diagram not derived from source
- product logo / trademarkを source relevance なしに prominent に描く
- 実在人物 / event の documentary photo のように誤認しやすい depiction

必要な factual diagram は deterministic SVG / Mermaid / chart renderer 等を使う。

## No baked article title by default

hero generation prompt へ article title の raster text 描画を要求しない。

理由:

- generated text error
- localization / title update mismatch
- accessibility
- crop / responsive reuse
- branding consistency

OGP に title を入れる場合は site-owned social-card renderer が deterministic に合成する。

## Style profile

article ごとに visual style を free-form で発明しない。

machine-readable style profile が所有する候補:

- visual language
- palette family / contrast target
- illustration mode
- composition
- texture
- allowed / forbidden subject treatment
- logo policy
- text policy
- aspect / safe-area defaults
- candidate generation budget

visual planner は semantic concept を作り、executor が style profile + hard restrictions と combine して final prompt を compile する。

## Candidate generation

exact candidate count / quality / dimensions は machine profile で管理する。

生成候補は private staging に置き、各 bytes を hash する。

生成は stochastic なので:

- same prompt != same output assumption
- selected raw bytes are immutable
- regenerate creates a new artifact/version

とする。

## Provenance

generated raw artifact は次を記録する。

- origin = `ai_generated`
- provider / model / snapshot
- request / prompt hash
- style profile version
- article clean-draft hash
- evidence bundle hash
- raw file SHA-256
- normalized derivative SHA-256
- generation timestamp
- moderation / visual audit refs

## Embedded provenance signals

provider が C2PA / watermark 等の provenance signal を付与する場合、camera EXIF と同じ「不要 metadata」として無条件に strip しない。

AI-generated raw artifact は normalization 前に provenance signal の存在を可能な範囲で検査・記録する。

public Web derivative では format conversion / resize によって metadata signal が失われる可能性があるため、embedded metadata だけを provenance SoT にしない。

full raw generated artifact と generation record を private retention policy で保持し、compact provenance を separate manifest へ残す。

OpenAI-generated supported images では C2PA metadata と SynthID watermark が提供される現行仕様があるが、provider coverage / export path は変わり得るため current provider docs を確認する。

## Disclosure

最低 requirement は machine-readable origin preservation。

visible disclosure policy は product UI として明示的に決める。

推奨 default:

- hero が `ai_generated` の場合、figure / hero metadata で「AI生成イラスト」等の小さな disclosure を表示できるようにする。
- factual screenshot / chart と同じ visual treatment で無表示にしない。

visible watermark を image pixels に焼き込むことは baseline requirement にしない。

## Visual audit

selected candidate は generator と独立した audit を通す。

review dimensions:

- semantic relevance
- no factual deception
- no accidental readable garbage text
- no fake UI / logs / metrics
- no unintended brand / logo implication
- crop / safe area
- quality / artifact
- accessibility alt / disclosure suitability

P0/P1 visual finding が残る candidate は publish package へ入れない。

## Moderation / safety

provider-side safety response に加え、pipeline-level visual safety / publication audit を行える adapter を持つ。

moderation model / provider は replaceable profile とし、architecture を特定vendorへ固定しない。

## Deterministic fallback cover

image generation unavailable / forbidden / repeatedly invalid の場合、design tokens と article metadata から cover を生成する。

fallback cover は「失敗画像」ではなく first-class artifact とし、Blog hero requirement を満たす。

これにより external image API を publication availability の single point of failure にしない。
