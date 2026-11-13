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
図版には内容が伝わるaltを必ず用意し、短い図題は必要な場合だけ付けて本文の近くへ置く。解釈は本文で一度示し、可視の説明・補足・倍率等の重複を図下へ積まない。必要な出典や権利表記は維持する。
Figureの短い図題、説明文、条件の補足、credit/sourceは[記事の図版標準](figure-standard.md)に従って分離する（後方互換追加の実装候補、未merge・未配信）。altへ長い補足を重複させず、題名や条件を画像に焼き込まない。
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

結論には読者の判断・次の行動を残す。必要な短い来歴・方法・強度評価の限界は、利用可能で承認済みのArticleEndnoteがある場合だけ、結論後のラベル付き補足へ分離できる。全記事へ強制せず、重要条件・安全は本文に残す。別Draft PR #182のruntimeをこの編集方針だけで採用した扱いにせず、任意JSX/HTMLで代用しない。

## 記事末尾の補足（Draft / レビュー候補）

制作方法、図・メディアの出自、実測した範囲と未検証事項を短く補う必要がある記事では、共通の`ArticleEndnote`を結論の後、共有・footerの前へ置く。全記事への必須枠にはしない。プリンタやMuJoCoを扱う記事も、実際の内容に即して必要な場合だけ同じ形式を選ぶ。本番採用や個別記事への適用済みを示すものではない。

```mdx
<ArticleEndnote title="図と検証について">

図は仕組みを説明する模式図です。寸法や荷重を測定した結果ではありません。

</ArticleEndnote>
```

例文は説明用であり、実際の図と検証内容に合わせて書く。タイトル省略時は「記事について」。短い段落に絞り、同じ免責を重ねない。図の説明・alt・出典は関係する図の近くに残す。長いコード、法的告知、主要な安全警告、重要な主張・適用条件は本文で扱う。末尾の補足を結論・次の操作・宣伝に広げない。
描画はSite所有の[semantic module契約](../contracts/content-module-contract.md#articleendnotedraft--レビュー候補)に従い、記事ごとのHTML/CSS、H2、目次項目、Calloutの注意装飾を追加しない。

## Links and citations

外部 source は本文の claim と対応する位置で示す。末尾に参考文献一覧を置く場合でも、どの主張を支えるか不明なリンク集にしない。

OSS / docs の文章を長く転記せず、自分の文脈に必要な要点を要約する。

## Privacy / publication safety

公開前に secret、token、private hostname / IP、個人情報、第三者の非公開情報、内部-only URL が含まれないことを確認する。

## Agent Skill

記事 draft / revision の反復 workflow は `.agents/skills/japanese-technical-blog/` に置く。公開用 MDX への組み込み・frontmatter・build validation は別 Skill に分離し、1 Skill = 1 job を維持する。

新規・実質改稿は[初稿制作workflow](../../.agents/skills/japanese-technical-blog/references/first-draft-integrated-workflow.md)を使い、[内部brief](../../templates/content/article-brief.md)を既存private Job notesに必要な分だけ反映する。設定推薦前の設計/材料の範囲、症状と対応図、初出別名、実データと模式の区別、局所の読みやすさを制作時に確かめる。H1とschema対応時の検索title、一つのdescriptionの詳細/一覧/meta/SNS/JSON-LDへの一致は実renderで確認し、SEO導出の所有者と既存承認境界を変えない。

## 日本語の編集と完成判定

[自然な日本語の編集](../../.agents/skills/japanese-technical-blog/references/natural-japanese.md)に従う。元の主張、条件、主体、断定の強さ、技術的意味を守り、欠けた資料を推敲で作らない。人間らしさの演出として一人称、感情、口語、語尾のランダム性を追加しない。
短い節は独立した答えの有無で判断する。必要な図・例・根拠が欠けている場合は説明を完成させる。結論枠、まとめ、番号付き手順を定型として強制しない。手順は操作と確認結果、診断は観察・候補・理由を区別する。
表示検証では、同じ原稿・図・出典を正式な描画経路で比較する。文章の自然さを自動テストのPASSだけで実証したと扱わない。

## 具体例・補足・ビジュアルの判断

[具体例・補足・図の編集判断](../../.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md)を適用する。問い見出しの常体と本文の敬体は両立する。実物・製品・設定例を説明に結び付け、各節への最低例数は設けない。重要な条件は近くへ残し、資料の詳細は分離、重複した免責は削除する。ヒーローに向くImageGenと正確な説明図を分ける。公式素材を正確に扱い、生成UIを実画面と見せない。

## 読者範囲・判断順序・図の文字階層

一般原理の記事は、ソフト名を知らない読者や別製品利用者も最初の節を理解できる構成にする。固有名詞の追加を具体化の代用にしない。判断の順序は症状と観察条件へ結び付け、節ごとに逆転させない。図は本文と同じ画面で検査し、モバイルの可読性とPCの文字階層を両立させる。詳しくは`.agents/skills/japanese-technical-blog/references/audience-and-visual-scale.md`。

図版の新規執筆は[図版標準](figure-standard.md)の簡素な基本形を使う。caption/noteは互換性のための任意機能であり、本文や画像内の説明を繰り返す既定欄ではない。


## 共通記事構造と分類の選び方

記事は共通のBlog frontmatter、BlogDetail、ContentLayout、登録済み本文moduleで組み立てる。題材ごとの別テンプレートや独自metadata HTMLを追加しない。共通にするのは項目の意味と表示部品であり、本文の章立てやタグの値・数ではない。

- `category` は広い主分類を一つ選ぶ。ロボティクス、電子工作、金属加工、工作、ソフトウェアなどから記事全体の主題に最も合うものを選ぶ。分類を技術タグの親として扱わず、category→tagの固定対応表を作らない。
- `technology` タグは階層を持たない。広い技術領域と具体的な方式・手法・言語・製品を同時に付けてよい。例えば `3d-printing` と `fdm`、`analysis` と `fea`、`control` と `modern-control` を本文に応じて併用する。これは二段階の階層や必須ペアではなく、広い語だけ・具体的な語だけでもよい。技術タグの数に一律の上限や推奨固定数を設けず、内容を表すために必要なものを選ぶ。本文に一度登場するだけの語は機械的に追加しない。
- `purpose` タグは記事の目的を表し、複数指定できる。解説は `explanation`、PRは `promotion`、エンジニアリングは `engineering`、症状の切り分けは `troubleshooting`、設計上の判断は既存の `design` を使える。同じ記事に解説とトラブルシューティングなどを併用してよい。PRはここでは製品・サービス等の紹介や告知を意味し、GitHubのPull Requestとは区別する。タグ付与だけで広告表記の要否を判断しない。
- 主分類のソフトウェアと技術タグを混同しないよう、横断的な技術タグは `software-development`（ソフトウェア開発）と表示する。既存 `analysis` のIDは保持し、technologyの「解析」として扱う。既存の `python`、`rust`、`go` は再利用し、同義の別IDを作らない。
- `topic` は上記とは別の横断的な主題がある場合だけ使う。更新紹介だからという理由で汎用の `release` を自動採用せず、対象技術と記事目的を先に表す。既存記事の分類は一括変更しない。
- 執筆前に `article taxonomy list --collection blog` でactive IDを確認する。主要技術や目的が未登録なら明示的なtaxonomy提案へ返し、既知の一般語へ無言で置き換えない。

BlogTaxonomyは同じタグ配列をregistryのkindで分類し、空の行だけ省略する。技術タグ・記事の目的・関連テーマのどれかが空でも、異なるschemaを使っているわけではない。独立QAではIDの存在だけでなく、主題・対象技術・読者目的に合うかを確認する。固定requestにtaxonomyがない場合は未検査を明記し、推測で合格にしない。新規・既成AI稿・更新稿でこの基準を共用し、候補と実renderの分類を照合する。

分類検索の6件の候補と24件のページングは表示上の分割であり、記事に付ける技術タグ・目的タグの上限ではない。


### 製品レビューと短い所感

製品を評価する記事も共通Blog構造を使う。例えば主分類 `gadgets`（ガジェット）、技術タグ `power-bank`（モバイルバッテリー）と `semi-solid-state-battery`（半固体電池）、目的タグ `review`（レビュー）という組合せを選べる。これは必須の対応ではなく、対象と本文に合うタグだけを付ける。半固体電池に触れない製品へ自動付与せず、方式の記述には根拠を確認する。

使用条件・評価基準・観察や比較の根拠・長所と限界などを整理し、読者が後から判断に使える評価は記事にする。購入直後の短い印象、一時的な気付き、まだ評価をまとめていない記録はNotesにする。文字数だけで境界を決めず、短くてもまとまった評価なら記事でよい。Notesは既存のsubject（例えば `everyday`）と共通タグを使い、専用レビューschemaや必須評価欄を追加しない。

目的タグ `review` は `explanation` や `promotion` などと、実際の目的に応じて併用できる。製品の記事だからレビューやPRを必ず付けるわけではない。PRタグの有無だけで提供・広告などの関係を示したことにせず、必要な開示は本文で別に扱う。Article Jobの `comparative_review` は執筆工程のmodeであり、公開用の目的タグとは別の概念として選ぶ。
