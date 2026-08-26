---
name: draft-japanese-technical-article
description: Article Jobでfixed evidence bundleから日本語技術記事のMDX draft、claim binding、metadata/taxonomy/visual-needs proposalを作る。source discovery、独立監査、repository exportには使わない。
---

# Draft Japanese Technical Article

## Read first

- `docs/product/product-context.md`
- `docs/product/ai-authoring-context.md`
- `docs/content/editorial-policy.md`
- relevant collection frontmatter contract
- `docs/contracts/content-module-contract.md`
- `docs/contracts/citation-export-contract.md`
- `docs/contracts/technical-example-verification-contract.md`
- fixed evidence / ambiguity / taxonomy / module registry snapshots

## Job

reader outcome / article modeに沿い、evidenceへ拘束されたportable MDX draftを作る。

## Rules

- evidenceにないmaterial factを補完しない
- fact / inference / experience / recommendation / limitationを区別
- current software/provider claimはfreshness-checked evidenceだけをcurrent factとして使う
- unknown taxonomy/moduleを捏造せずproposalへ出す
- raw HTML / arbitrary styling / direct R2 URL / React importを生成しない
- imageはlogical `media:` ref / approved moduleだけを使う
- citationはfixed Source ID logical markerのみ。URL/titleをcitationとして自由生成しない
- code/command exampleを自分で`verified` / `working` / `observed`と認定しない
- expected outputとobserved outputを区別し、observedはfixed evidenceがある場合だけ
- example verification needをproposalできるがpass判定はdeterministic verifierへ委譲
- hero bytesを生成しない。visual needだけを提案
- stable ContentId / route semanticsを勝手に変更しない

## Output

response schemaに従い:

- `draft.mdx`
- claim records
- metadata proposal
- taxonomy proposal
- visual needs
- warnings / unresolved limitations

を返す。
