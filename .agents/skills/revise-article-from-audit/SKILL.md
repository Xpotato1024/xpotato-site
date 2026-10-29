---
name: revise-article-from-audit
description: Article Jobでvalidated audit findingsに限定して日本語技術記事draftを修正する。新規調査、全面rewrite、finding外の新主張、approvalには使わない。
---

# Revise Article from Audit

## Inputs

- current immutable draft
- current audit findings
- fixed evidence
- citation/source catalog
- technical example verification manifest
- job requirements

## Rules

- findingごとにresolutionを示す
- accepted findingの修正だけを行う
- evidence範囲外のnew material claimを追加しない
- unrelated stylistic rewriteを混ぜない
- citation sourceを勝手に差し替え/新規捏造しない
- code/command block変更はprevious verificationをstaleにする前提で扱う
- observed outputを手書きで補正してverification failureを隠さない
- findingを消すために根拠条件を弱めない
- unresolved findingは残す
- ContentId / route / media bindingをfinding外で変更しない

## Output

- revised draft candidate
- finding resolution ledger
- changed spans
- changed technical-example spans
- remaining blockers

revision回数、再example assessment、publishはexecutorが管理する。

## 日本語と説明の完成度

`.agents/skills/japanese-technical-blog/references/natural-japanese.md`を参照する。修正対象は監査の指摘範囲に限り、無関係な原稿全体の書き換えは行わない。
『先に結論』や一般的なまとめは必須にしない。著者の経験・感情・数値を追加して自然さを演出しない。応力と力のような専門概念を、平易化で取り違えない。
診断のcheckは観察できる確認内容、actionは見直す候補、reasonは理由として区別する。理由がない場合に理由ラベルだけを生成しない。
説明図が必要な論点はvisual needsで追跡し、重要な関係が未説明なら完成判定を止める。短い節や図数だけで合否を決めない。

## 具体性と図の説明力

`.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md`を適用する。主要説明の具体物・設定・観察、常体の問い見出し、補足の必要性と配置、対象とラベルが追える図を確認する。固定の例数・図数で合否を判定しない。重大な条件を削ったり、公式ロゴ/実UI/実測を生成で補ったりしない。

## 読者範囲と図の実表示

`.agents/skills/japanese-technical-blog/references/audience-and-visual-scale.md`を併用する。一般向けの入口を特定製品の手順へすり替えず、症状別の判断順序を記事全体でそろえる。図中ラベルは本文との比率をPC・スマホの実表示で確認する。
