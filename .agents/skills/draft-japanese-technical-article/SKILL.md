---
name: draft-japanese-technical-article
description: Article Jobでfixed evidence bundleから日本語技術記事のMDX draft、claim binding、metadata/taxonomy/visual-needs proposalを作る。source discovery、独立監査、repository exportには使わない。
---

# Draft Japanese Technical Article

## Read first

- `docs/product/product-context.md`
- `docs/product/ai-authoring-context.md`
- `docs/content/editorial-policy.md`
- `.agents/skills/japanese-technical-blog/references/visual-structure.md`
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
- 読者の利用場面を明確にし、見出しの流し読みでも問い・判断・条件が分かるようにする
- 症状→確認→理由はDiagnosticList/DiagnosticItemを選べる。手順、比較、条件分岐とは区別する
- 難しい語を闇雲に削らず、理解に必要なとき初出で短く説明する。文体は自然で親しみやすく、過度な煽りは避ける
- 読者が図なしでは断面/方向/順序/比較/因果を脳内で補う箇所をvisual needsとして記録する。無理な画像枚数ノルマは設けない
- 供給写真が足りなければ撮影目的・方向・枚数・代案を未解決提案として返し、存在しない写真や実測を補作しない
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

## 日本語と説明の完成度

`.agents/skills/japanese-technical-blog/references/natural-japanese.md`を参照する。語尾や禁止語の数ではなく、読者の疑問への答え、必要な条件、図の説明、文章のつながりを確認する。
『先に結論』や一般的なまとめは必須にしない。著者の経験・感情・数値を追加して自然さを演出しない。応力と力のような専門概念を、平易化で取り違えない。
診断のcheckは観察できる確認内容、actionは見直す候補、reasonは理由として区別する。理由がない場合に理由ラベルだけを生成しない。
説明図が必要な論点はvisual needsで追跡し、重要な関係が未説明なら完成判定を止める。短い節や図数だけで合否を決めない。

## 具体性と図の説明力

`.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md`を適用する。主要説明の具体物・設定・観察、常体の問い見出し、補足の必要性と配置、対象とラベルが追える図を確認する。固定の例数・図数で合否を判定しない。重大な条件を削ったり、公式ロゴ/実UI/実測を生成で補ったりしない。
