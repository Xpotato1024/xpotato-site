---
name: japanese-technical-blog
description: 日本語の技術ブログ記事を作成・改稿するときに使う。読者と記事型を定義し、一次情報や実測を優先して claim/evidence を整理し、構成、技術例、本文、引用、推敲まで行う。architecture document、ADR、README、単なる repository への MDX 組み込みには使わない。
---

# Japanese Technical Blog

## Purpose

公開する日本語技術記事を、根拠の追跡可能性、読者の理解、再現可能性を重視して作成する。

SEO 定型文や一律の文体テンプレートへ最適化せず、記事の reader goal と evidence に応じて構成を変える。

## Read first

1. `docs/content/editorial-policy.md`
2. 記事 topic に関係する repository evidence / canonical docs
3. 必要に応じて `references/research-basis.md`
4. 記事型に応じて `references/article-structures.md`
5. tutorial / explanation で code example が重要なら `references/technical-examples.md`

## Scope

Use this Skill for:

- technical blog article の新規 draft
- 既存記事の技術的・編集的な改稿
- investigation / incident / build log の article 化
- technical comparison の構成と執筆
- fact / source / citation review を伴う記事編集

Do not use this Skill for:

- architecture SoT / ADR / runbook / README
- approved article の frontmatter / file placement だけを行う作業
- production deploy
- R2 upload
- article topic と無関係な code implementation

## Required inputs

最低限、次のうち task から取得できるものを整理する。

- topic / reader problem
- target reader と前提知識
- article mode
- repository / log / experiment 等の available evidence
- current source が必要な version / date-sensitive claim
- publish してはいけない情報の境界

不足していても task を進められる場合は、推測で fact を作らず scope / limitation を明示して best effort で進める。

## Workflow

### 1. Define reader outcome

「記事を書き終える」ではなく、読者が読み終えたとき何を理解・判断・実行できるかを1文で定義する。

記事型を1つ選ぶ。

- explanation
- tutorial
- investigation
- build log
- incident / troubleshooting
- comparative review

複数型を混ぜる場合も primary mode を決める。

### 2. Build an evidence ledger

本文より先に主要 claim を列挙する。

各 claim について少なくとも次を確認する。

- `claim`: 記事で述べたいこと
- `class`: fact / inference / experience / recommendation / unknown
- `source`: official docs / paper / repository evidence / measurement / secondary source
- `freshness`: current verification が必要か
- `confidence`: confirmed / bounded / unverified

source がない fact をもっともらしい文章で埋めない。

software version、current API、provider behavior、benchmark、法律・標準等の変動 claim は current source を再確認する。

### 3. Prefer evidence by hierarchy

原則として次の順で選ぶ。

1. official specification / upstream official docs / release note
2. primary paper / standard / authoritative dataset
3. repository code / commit / log / actual measurement
4. high-quality secondary source
5. community report

community experience を一般事実へ昇格させない。

### 4. Choose article structure

`references/article-structures.md` を使い、reader goal に必要な section だけを選ぶ。

repository directory 順や source code file 順を、そのまま article outline にしない。問題、mechanism、decision、data flow、trade-off など読者が追う意味構造を優先する。

### 5. Draft problem-first

冒頭で、reader problem、observed situation、question、unexpected result のいずれかを早く提示する。

定型の「この記事では〜について解説します」だけで導入を消費しない。

本文では:

- 1文に独立した主要命題を詰め込みすぎない。
- 条件、原因、結果、例外の連結が長くなったら分割する。
- 1段落は1つの小論点を中心にする。
- sequence / comparison / branch は prose に押し込まず list / table / diagram を検討する。
- 専門語は target reader に必要な粒度で初出定義する。
- 不要な英語・カタカナ語を増やさない。

固定の文字数制限や readability score へ機械的に最適化しない。

### 6. Explain technical examples

instructional article では `references/technical-examples.md` に従う。

原則:

1. example の目的を先に示す。
2. reader が理解できる最小 complete context を示す。
3. solution / code の後で、重要な mechanism と判断を説明する。
4. novice 向けでは複雑な example を意味単位に分割する。
5. output / observation を示せる場合は、期待値と観測値を区別する。

実行していない code を「動作確認済み」と書かない。

### 7. Separate fact from interpretation

fact と recommendation を同じ断定文へ押し込まない。

- measured / observed fact
- evidence からの inference
- author environment での experience
- trade-off を踏まえた recommendation
- remaining unknown

が読者に区別できるようにする。

### 8. Review citations and links

source は claim と対応する位置で示す。末尾の URL 集だけで根拠関係を曖昧にしない。

OSS / documentation の長文を転記しない。必要な claim を自分の文脈で要約し、source を示す。

### 9. Editorial revision

少なくとも次を見直す。

- 冒頭で reader problem が見えるか
- 見出しだけで論理の流れを追えるか
- 同じ説明を別 section で重複していないか
- source が claim を本当に支えているか
- experience を一般化していないか
- code と本文が version / behavior 上一致しているか
- conclusion が単なる本文再掲になっていないか
- limitation / applicability が必要なら残っているか

### 10. Publication safety check

公開前提の draft では次を検査する。

- secret / token / credential
- private hostname / private IP / internal URL
- third-party private information
-個人情報
- unpublished repository detail

公開可否が不明な具体値は伏せるか、明示確認対象として残す。

## Outputs

Task に応じて次の1つ以上を返す。

- evidence ledger
- article outline
- article draft / revision
- fact/source review
- unresolved claims / publication-risk list

repository への file placement / frontmatter / build integration は `$site-content-publish` の責務とする。

## Definition of Done

- reader outcome と article mode が一貫している。
- material fact に traceable source / evidence がある。
- unverified claim を fact として断定していない。
- article structure が source structure ではなく reader logic に沿っている。
- technical example は目的、context、説明を持つ。
- public-safety review が済んでいる。
- unresolved limitation が必要なら明示されている。

## Stop / escalation

次の場合は断定を避け、未確認として扱う。

- primary evidence が矛盾する
- current version / provider behavior を確認できない
- benchmark / experiment の raw evidence がない
- private / public の境界が不明
- article の結論が source より強い
