---
name: independent-article-audit
description: Article Jobでtarget draftをfixed evidence、citation binding、technical-example verificationに対してfresh contextで独立監査しP0/P1/P2 findingsを返す。draft生成、revision、approvalには使わない。
---

# Independent Article Audit

## Read first

- `docs/contracts/source-evidence-claim-contract.md`
- `docs/contracts/citation-export-contract.md`
- `docs/contracts/technical-example-verification-contract.md`
- `docs/content/editorial-policy.md`
- target draft
- fixed evidence / ambiguity
- citation binding
- technical example verification manifest
- job requirements

## Independence

previous author/reviserのprivate reasoning、prompt history、self-evaluationを正解として使用しない。

本文からmaterial claimを再抽出する。

固定schemaの`independentlyExtractedClaims[].text`には、`audit-body`の連続した原文をそのまま写す。要約・言い換え・Markdown除去・文字正規化をしない。`span`は同じ原文のJavaScript UTF-16開始位置と終了位置（終了を含まない）であり、`audit-body.slice(start,end) === text`が必須。渡された`audit-body-index`の1行全体を使う場合は、その`start/end/text`をそのままコピーしてよい。複数の主張を含む段落は同じ原文範囲へ複数根拠を結んでよい。独立判断や指摘の説明と、位置を結ぶ原文引用を混同しない。
原文位置を特定できないものを架空の位置で補ってpassにせず、未解決として返す。

## Severity

- P0: fabricated fact/source、逆内容、publication safety breach、重大なmisrepresentation
- P1: material evidence gap、unsupported inference、version/date error、重要要件欠落、misleading instruction、critical example failure
- P2: clarity、redundancy、軽微なstructure/style

## Rules

- findingをtarget span + evidence/requirementへbind
- citationがclaimを本当にsupportするか確認
- private source leakage / fabricated URLを許可しない
- `syntax_checked`だけのexampleを動作確認済みと表現していないか確認
- `observed` outputにexecution/evidence lineageがあるか確認
- risky commandのscope/warningを確認
- 見出しだけを追って読者の問い・判断・適用条件が見えるか確認
- 表/リスト/診断の役割が混同されていないか、冗長な同内容の反復や用語の未定義がないか確認
- 図を置かないと断面・力の向き・手順・比較関係が重大に誤解される箇所はvisual-needs不足として指摘。単純な画像枚数不足をfindingにしない
- sourceにない正解を自分で補完してfinding根拠にしない
- author claim ledgerは補助比較のみ
- audit自身がapprovalを生成しない
- limitationsは未充足の必須検査・根拠不足を示す。契約で対象外の外部再取得や実物試験を行わなかったことだけではgapにしない。ただし本文が最新性・実測・動作確認などを主張するなら、その支持は必須として不足を残す。
- hashで結んだreference描画画像は掲載幅・本文との関係を調べる資料であり、公開承認・人間監査・実機検証や最終配信bytesの受入れではない。

## Output

- independently extracted claims
- findings
- unresolved limitations
- pass / revision-required signal

## 日本語と説明の完成度

`.agents/skills/japanese-technical-blog/references/natural-japanese.md`を参照する。語尾や禁止語の数ではなく、読者の疑問への答え、必要な条件、図の説明、文章のつながりを確認する。
『先に結論』や一般的なまとめは必須にしない。著者の経験・感情・数値を追加して自然さを演出しない。応力と力のような専門概念を、平易化で取り違えない。
診断のcheckは観察できる確認内容、actionは見直す候補、reasonは理由として区別する。理由がない場合に理由ラベルだけを生成しない。
説明図が必要な論点はvisual needsで追跡し、重要な関係が未説明なら完成判定を止める。短い節や図数だけで合否を決めない。

## 具体性と図の説明力

`.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md`を適用する。主要説明の具体物・設定・観察、常体の問い見出し、補足の必要性と配置、対象とラベルが追える図を確認する。固定の例数・図数で合否を判定しない。重大な条件を削ったり、公式ロゴ/実UI/実測を生成で補ったりしない。

## 読者範囲と図の実表示

`.agents/skills/japanese-technical-blog/references/audience-and-visual-scale.md`を併用する。一般向けの入口を特定製品の手順へすり替えず、症状別の判断順序を記事全体でそろえる。図中ラベルは本文との比率をPC・スマホの実表示で確認する。
