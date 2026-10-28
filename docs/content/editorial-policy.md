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

## 読者の読む状況と流し読み

題材だけで対象読者を決めず、読者の前提知識・読む状況（作業中/比較中/学習中/検証時）・読後にできることを具体化する。
見出しだけを流し読みしても、問い、判断、適用条件を追える構成にする。見出しの階層は意味の従属関係であり、強調装飾のために乱用しない。
条件と対策の繰り返しは表・箇条書き・許可済みsemantic moduleを検討する。手順と選択肢を混同しない。

## 図版・アイコンと文章を一緒に設計する

図の枚数は一律に定めない。本文を読む人が脳内で補完しなければならない断面・方向・順序・比較・因果分岐を見つけ、図で負担を減らせる場合に作図する。
SVGは正確な構造/荷重/手順、実写真は現物や失敗の観察、元データのグラフは定量的根拠、ImageGenは概念/情景の説明に用いる。生成画像を実測/実写と誤認させない。
既存の提供写真を先に検討し、不足が重要なら必要箇所・方向・枚数・撮れない場合の代替案を具体的に依頼する。
図版には図が伝える内容を明示するキャプション・altを用意し、関係する本文の近くへ置く。
小さなSVGアイコンはCallout、目次、診断など意味のある共通構造に限る。文章のラベルを省かず、記事ごとの任意装飾を増やさない。
図版と本文を統合して推敲し、図の内容を冗長な文章で重ねて繰り返さない。
完成原稿を求められ、根拠・権利・ツールが許すなら、図版は候補提示だけで止めず制作して挿入する。権限を持たないArticle Jobの各semantic stageはvisual needs/proposalまでで、後続の正規media工程へ引き渡す。
詳細は .agents/skills/japanese-technical-blog/references/visual-structure.md と docs/contracts/content-module-contract.md。

## 文体の親しみやすさ

技術的な厳密さを保ったうえで、自然な疑問、身近な例、「まず確認しましょう」等の具体的な動作を使う。
用語は読者の理解に必要な場合だけ初出で説明し、単に専門的に見せる言葉を増やさない。
過剰な共感・煽り・馴れ馴れしさは避ける。確証のない因果は親しみやすさの名目で断定しない。

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
