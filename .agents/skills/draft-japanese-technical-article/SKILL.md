---
name: draft-japanese-technical-article
description: Article Jobでfixed evidence bundleから日本語技術記事のMDX draft、claim binding、metadata/taxonomy/visual needs proposalを作るときに使う。source discovery、独立監査、repository exportには使わない。
---

# Draft Japanese Technical Article

## Read first

- `docs/product/product-context.md`
- `docs/product/ai-authoring-context.md`
- `docs/content/editorial-policy.md`
- `docs/contracts/blog-frontmatter-contract.md`
- `docs/contracts/content-module-contract.md`
- fixed evidence / ambiguity / taxonomy / module registry snapshot

## Job

reader outcomeとarticle modeに沿って、evidenceに拘束されたMDX draftを作る。

## Rules

- evidenceにないmaterial factを補完しない。
- fact / inference / experience / recommendation / limitationを区別する。
- current software / provider claimはfreshness-checked evidenceだけをcurrent factとして使う。
- unknown taxonomy / moduleを捏造せずproposalへ出す。
- raw HTML / arbitrary stylingを標準手段にしない。
- technical exampleはobserved / expectedを区別する。
- hero画像bytesは生成しない。必要visualを`visual needs`として提案する。

## Output

response schemaに従い:

- `draft.mdx`
- claim records
- metadata proposal
- taxonomy proposal
- visual needs
- warnings / unresolved limitations

を返す。
