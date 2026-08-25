---
status: proposed
owner: content
last_verified: 2026-08-25
canonical_for:
  - Japanese technical article editorial policy
  - evidence and source policy
---

# Editorial Policy for Japanese Technical Articles

## 目的

検索流入向けの定型 SEO 文を量産するのではなく、読者が「何が起きたか」「なぜそう判断したか」「どう再現・応用できるか」を追える技術記事を作る。

## Evidence hierarchy

事実主張は可能な範囲で次の順に根拠を選ぶ。

1. official specification / official docs / upstream release note
2. primary paper / standard / authoritative dataset
3. repository code、commit、log、measurement 等の一次 evidence
4. high-quality secondary source
5. community report は experience / hypothesis として明示

version、date、provider behavior のように変わり得る主張は、記事作成時に current source を確認する。

観測していない benchmark、障害原因、改善率、実行結果を生成しない。

## Claim classes

記事内で次を混同しない。

- fact: source / measurement で確認できる
- inference: fact から導いた判断
- experience: author の環境で起きたこと
- recommendation: trade-off を踏まえた提案
- unknown / limitation: 未確認事項

必要な場合は本文表現で区別し、すべてを断定形へ均すことを避ける。

## Japanese readability

機械的な「1文XX文字以下」を絶対規則にしない。ただし日本語の readability 研究では sentence length、文字種、句読点などの surface feature が読みやすさと関連するため、長い複文を無制限に許容しない。

実務上は次を使う。

- 1文に主要命題を詰め込みすぎない。
- 条件、原因、結果、例外が連結し続ける場合は分割する。
- 段落は1つの小論点を中心にする。
- comparison、手順、条件分岐は prose に押し込まず list / table を使う。
- 専門用語は対象読者が知らない可能性がある場合、初出で短く定義する。
- カタカナ語や英語表記を「技術的に見える」ためだけに増やさない。

readability score は補助 signal として使えても、専門性・正確性を犠牲にして数値目標へ最適化しない。

## Article modes

記事作成時に主目的を1つ選ぶ。

- explanation: 概念や仕組みを理解させる
- tutorial: reader が手順を実行できるようにする
- investigation: 問題、evidence、仮説、検証、結論を追う
- build log: 設計選択と実装過程を記録する
- incident / troubleshooting: symptom、scope、cause、fix、prevention を記録する
- comparative review: criteria と trade-off を比較する

形式を固定テンプレートとして全記事へ強制せず、reader goal に合う構造を選ぶ。

## Technical examples

instructional article では、断片コードだけでなく reader が context を理解できる worked example を優先する。

- 先に「この例で何を確認するか」を示す。
- 必要最小限の complete example を提示する。
- code の直後に重要な判断 / mechanism を説明する。
- novice 向けでは例を意味単位に分節し、結果から理由を説明させる問いや確認点を入れてよい。

ただし investigation / report の記事へ tutorial 形式を無理に持ち込まない。

## Opening and conclusion

冒頭では定型の「この記事では〜を解説します」だけで始めず、reader problem / observed situation / question を早く提示する。

結論は本文の要約だけでなく、適用条件、残る limitation、next action のうち有用なものを示す。

## Links and citations

外部 source は本文の claim と対応する位置で示す。末尾に参考文献一覧を置く場合でも、どの主張を支えるか不明なリンク集にしない。

OSS / docs の文章を長く転記せず、自分の文脈に必要な要点を要約する。

## Privacy / publication safety

公開前に secret、token、private hostname / IP、個人情報、第三者の非公開情報、内部-only URL が含まれないことを確認する。

## Agent Skill

記事 draft / revision の反復 workflow は `.agents/skills/japanese-technical-blog/` に置く。公開用 MDX への組み込み・frontmatter・build validation は別 Skill に分離し、1 Skill = 1 job を維持する。
