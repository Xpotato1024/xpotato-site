# 読者起点の初稿制作：briefから本人限定previewまで

新規記事・実質改稿で使う共通の編集工程。更新紹介と工作・設定比較で得た判断を一般化し、制作時に確かめる。
参考記事の章立て、用語、数値、画像枚数、四つの時刻を別の記事へ移植しない。
初稿の取りこぼしを減らす工程であり、フィードバックがゼロになる保証ではない。
方針の正本は[editorial-policy](../../../../docs/content/editorial-policy.md)、提出基準は[F01–F12](first-draft-quality-gate.md)。

## 1. 内部briefで読者の判断と範囲を決める

[article-brief](../../../../templates/content/article-brief.md)を手掛かりに、既存Jobのメモへ必要分だけ整理する。
ユーザーへ渡す記入票、追加承認、公開MDXの一部にはしない。分かる条件を聞き直さない。
読者が今見ている症状・疑問、共有していない前提、読後に選べることを一文ずつ決める。
記事の主目的と対象外を先に選び、見出しは各節で答える問いから作る。
共通frontmatterと登録済みmoduleを使い、分類は主分類・対象技術・読者目的・必要な場合だけ関連テーマの順に選ぶ。
active taxonomy IDとkindを確認し、MuJoCoなど主題の製品や技術が未登録なら明示提案へ戻す。更新紹介をreleaseだけで分類しない。
共通BlogTaxonomyの空行省略とschema差を混同せず、候補と実renderで分類の意味を照合する。
設定変更を勧める前に、形状・荷重・材料・用途の設計で解く問題か、印刷等の調整で扱う問題かを分ける。
更新紹介では、従来の問題、既存の回避策、新機能が変えることを分け、旧機能を新登場としない。
代替案を消して一つの設定や新機能を万能に見せず、この記事で比較する範囲を固定する。
release notes、tutorial、troubleshooting、comparative reviewでは、それぞれの読者目的に合わせて順序を変える。
[article.md](../../../../templates/content/article.md)は短い初期本文であり、全modeで自然に置換してよい。固定の完成稿構成ではない。

## 2. 問いからsourceとevidenceをそろえる

主要claimごとに、支持する固定Source ID、版・時点、evidence、支持しない範囲を結ぶ。
fact / inference / experience / recommendation / unknownを区別し、欠けた実測や体験を推敲で作らない。
変動する仕様・更新の主張はcurrent sourceへ結ぶ。discovery候補を固定sourceと呼ばない。
比較は対象、固定条件、変更条件、成功条件、計測範囲を測る前に決める。
速くても目的に失敗する基準条件は残し、成功した対策として推薦しない。
数値は単位・対象・条件・分子/分母・集計範囲を確かめ、実測値と説明用の値を明確に分ける。
模式的な破断線や設定比較から、実際の破損・強度・改善率を主張しない。
evidence stageは固定sourceから抽出し、不足をambiguityへ返す。新しい調査や計測を勝手に始めない。

## 3. 本文と実素材を同時に設計する

読者の症状を述べた直後に、その症状を理解できる対応モデル・写真・実画面を置く計画にする。
必要な図を遠い資料欄へ送らず、問い→見る対象→理由→選択を同じ読順で追えるようにする。
部品名・方向・設定名は、初出の説明と図中の対象を対応させる。
例えば外周数/ウォール数、充填率/インフィル密度、トップ層、造形方向/印刷方向は、別名と見える箇所を早く結ぶ。
別名は対象製品での意味を確認する。すべての語を全記事へ並べる規則ではない。
図ごとに「どこを見ると何が分かるか」を決め、ラベル・矢印・本文の呼び名をそろえる。
破断部・充填構造・トップ層等は、全体が切れても重要な局所をcrop/zoomして読める大きさにする。
ただし対象の識別、向き、比較条件は小さな全体図・共通ラベル等で保つ。全体像が主題なら全景を優先する。
比較では同じ対象・視点・倍率、固定条件と変更点を対応させる。cropで都合の悪い結果を隠さない。
サイトのpalette/tokensと文字階層を参照し、色だけに頼らず識別できる図にする。
承認済みの良いoriginal heroは最初のasset planで保持対象とし、本文の技術図で置き換えない。
heroは記事の識別と導入、説明図は理解、観測写真・データは証拠という役割を分ける。

## 4. 実データから図を制作する

モデルや実行結果の制作が依頼・認可されている場合は、再利用できる元データと実出力を先にそろえる。
CADソースと交換用モデル、実スライサー設定・3MF・G-code、simulationモデル・設定・保存state等を題材に応じて残す。
再読込・再生成と入力→出力→掲載図の対応を確かめ、source/delivery版・hash・ContentIdを記録する。
実G-codeの別viewer描画、断面表示、非表示層、模式図は、その表示上の性質を正直に区別する。
生成したモデル風・スライサー風画像は実モデルや実出力の代わりにならない。
実破損写真・original evidenceと、破損を説明する概念図を区別する。生成画像を観測の証拠にしない。
実機適合を確認していない参考G-codeを、そのまま機器で使えると扱わない。
semantic draft/plannerはvisual needs/proposalまで。後続の認可された制作工程が実素材を作る。
固定requestにない制作・取得をauditorへ要求せず、不足は対象範囲のfinding/未準備として残す。

## 5. 読者に必要な本文だけを書く

リードは対象・読む理由、導入は背景・用途、その後は各節の問いへ進み、同じ定義を繰り返さない。
補助指標は比較の目的・対象・条件の後、理解が必要な初使用位置で短く説明する。
例えばRTFが表を読む道具なら文脈→短い定義→表→解釈。RTF自体が主題なら定義から始めてよい。
既知の指標は再定義せず、表の後まで未定義にしない。
方法・試験片寸法・capture手順・詳細版情報は再現用docs/元データへ残す。
判断・安全・結果の解釈を変える条件と、操作が目的のtutorialの手順は本文から削らない。
図周辺は画像＋必要なら短い図題＋必要な出典を基本にする。
再生速度・時刻・左右対応をcaption/note/本文で重ねず、解釈は本文へ一度置く。
alt、出典、再生/停止、aria-label、focus、静止表示の必要性は重複削除と別に保つ。
[自然な日本語](natural-japanese.md)で意味・主体・条件・断定の強さを守り、禁止語の数で合否を決めない。

## 6. 検索意図と記事の説明をそろえる

読者の検索語と同義語をbriefへ結ぶ。例えば「3Dプリンタ 充填率 100」と「3Dプリンタ インフィル 100」は同じ問いになり得る。
用語を本文の自然な初出説明へ結び、H1へ別名を詰め込まない。
schemaが支持する場合のみ、H1と役割の違う自然な`seo.titleOverride`を提案する。相違を必須にしない。
authoritativeなdescriptionは一つ。詳細/一覧の説明、meta/OG/Twitter、WebPage/BlogPosting JSON-LDで同じ内容を使う。
通常はfrontmatter `description`を正本にし、古い`seo.descriptionOverride`等との分岐を検出する。draft/noindexの意図した非出力は公開出力と分ける。
metaだけ更新して古いJSON-LD descriptionを残さない。構造化データを本文側に手書きで複製しない。
[site-seo-review](../../site-seo-review/SKILL.md)の担当経路で実renderを照合し、taxonomy/canonical/noindex/heroを保持する。
meta keywords、検索順位保証、別の公開経路は加えない。

## 7. 結論と任意の末尾補足を分ける

結論は読者の判断・次に試すことを短く示す。全節再掲や制作手順で締めない。
必要な来歴・方法・強度評価の限界等が残る場合だけ、結論の後へラベル付きのcompactなArticleEndnoteを置く。本文見出しや目次項目を増やさず、補助情報と分かる表現にする。
ArticleEndnote Site標準は別Draft PR #182の範囲。対象snapshotでmoduleが利用可能かつ承認済みの場合だけ使う。
未利用可能なら挿入せず、必要な資料は既存の許可されたMarkdown経路で示す。任意のJSX/HTMLやruntime importで代用しない。
判断を左右する適用条件・安全条件は本文の該当箇所に残し、endnoteへ隠さない。
全記事にendnoteを強制せず、結論の代わりにも、長い再現資料の収納先にも使わない。

## 8. 独立QAを通して本人限定previewへ渡す

authorの自己点検後、technical-example assessment→fresh content audit→限定revisionを既存順で行う。
P0/P1 content findingが残ればvisual/approvalへ進まない。修正はvalidated findingと依存範囲に限る。
content-clean後にvisual plan→制作/ingest→fresh visual audit→variants→candidateの順を保つ。
auditorは固定資料と実対象から独立判断し、author/plannerの自己評価を正解として受け取らない。
PC/スマホ幅の本文・局所図・表・操作とSEOの実出力を照合する。不足したrenderを確認済みにしない。
原稿の構造test、semantic editorial eval、実表示QA、読者の理解度はそれぞれ別の証拠。
完成した本文・実素材・根拠・未解決事項を同じ候補へ結び、認可済みの本人限定previewで初回提示する。
owner-onlyのaccessを保持し、ローカルpreview、共有Siteの保存、production公開、人間承認を区別する。
既存のfixed response schemas、fresh author/auditor境界、exact disclosure manifestを変えない。
previewは保存・upload・export・deployの認可ではない。既存のhuman approvalとpublication gateを引き継ぐ。

## 適用例：briefから最初のpreviewまで

brief：「内部を詰めれば壊れにくいか」という問いを、設計/材料と設定の範囲へ分け、選択できることを決める。
source/evidence：一次資料と提供観測を固定し、設定と構造の関係、実強度を未測定である範囲を分ける。
text/real assets：初出の別名を断面モデルで示し、症状の直後に対応する写真/モデルを置く。実CADとスライス出力から局所図を作る。
SEO：検索別名を対応付け、自然なH1と必要なら検索title、一つのdescriptionを決め、全出力を比較する。
article endnote：結論を判断で閉じ、必要な来歴・限界だけを利用可能な承認済みmoduleへ分離する。
independent QA：claim/観測と模式の区別、局所の読める幅、元hero保持、JSON-LDを含むmetadata一致を担当範囲で確認する。
owner-only preview：同じ候補と実素材を限定表示へ渡す。方法資料は再現可能に残し、本文を制作日誌にしない。
更新紹介でも、古い問題→新機能→同条件の実state比較へ読み替え、測定値や時刻・図数は流用しない。
