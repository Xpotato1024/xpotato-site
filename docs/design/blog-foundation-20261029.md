---
status: proposed
owner: content
last_verified: 2026-10-29
---

# Blogの主分類・関連タグ・SNS表示の一体案

採用判断待ちの設計と検証用実装。基点はmain `12155a027027177ca29218f024a60dc3ab1f5e26`。新分類・カード案を採用せず、既存45件のBlogのhold、3Dプリンタfixture、公開・provider gateを変えない。

## 読者の二つの入口

主分類は「この記事をどの棚で探すか」、関連タグは「棚を横断して何について読むか」。既存frontmatterは単一の`category`と配列`tags`を既に分離している。分類IDをタグへ複写して所属の代わりにしない。記事の形式（手順・比較・レビュー）や進行状態も主分類に混ぜない。

現在の分類seedはsoftware / infrastructure / robotics、移行対象44件は31 / 12 / 1件。追加の検索fixture1件もsoftware。Gale・RAG・Windowsの比重が高く、ガジェット・工作の多段分類を先に空で量産する根拠はまだない。例示された「電子工作・モデリング・3Dプリンタ」は、工作の下位候補であり採用済み分類ではない。3Dプリンタは設定・造形の継続的記事群をまとめる場合は主分類の子、複数分野に登場する機器属性としてはタグにもなり得る。両方を作る場合は棚と横断属性の役割の違いを記述する。

推奨はトップ3〜6程度、通常2段・最大3段、記事の主分類は最も適切な1件。複数所属はパンくずの経路を曖昧にするため採らず、別分野との関係はタグ・関連記事・本文リンクで表す。数の範囲は編集の目安で、schemaのトップ数上限ではない。

### 具体的な棚の候補（データ未採用）

短期は現3件を保持する。将来の第一候補は「ソフトウェア」「インフラ」「ものづくり」の3本で、継続的な紹介・評価記事が揃った時に「ガジェット」を4本目として追加する。「プログラミング」はソフトウェアの表示名候補または下位分類であり、同じ記事群を覆うトップを二重に作らない。

ものづくりの下位候補は「ロボティクス」「電子工作」「モデリング」「3Dプリンタ」。すべてを同時に作らず、継続記事を割り当てられる棚だけ開く。既存roboticsを新しい親makingの下へ移してもID・記事URL・分類slugは保持できる。3Dプリンタの機器選定・レビューならガジェット、造形設定・部品製作ならものづくり、制御ソフトの実装が主題ならソフトウェアを主分類候補にする。同じ機器・材料・言語を関連タグで横断する。この例は既存記事やfixtureの所属を確定するものではない。

「モデリングの子に3Dプリンタ」を固定すると、形状設計と造形・機器設定の異なる目的が混ざるため、最初は並列候補が自然と考える。3段目は記事量と読者の探索目的から必要になった場合だけ使う。新しい棚の採用PRでは、対象記事一覧・件数・定義・除外例・重複するタグとの違いを提示する。

### 採用前の比較

| 案 | 利点 | 課題 |
|---|---|---|
| 現3分類を平坦のまま維持 | 移行不要 | 工作等が増えた時の棚を表現しにくい |
| 単一主分類＋任意の親ID（推奨） | 既存IDを保持して段階拡張。所属経路が一意 | 新しい棚・reparentは編集判断が必要 |
| 複数カテゴリ所属 | 同じ記事を複数の棚へ置ける | 主経路・件数・パンくずの意味が複雑になる |
| 分類パスを記事URLへ含める | URLから棚が見える | 分類整理のたびに記事redirect・canonical変更が必要 |

IDは不変、labelは表示名、slugは分類一覧のURL。任意`parentId`だけをschemaへ追加し、既存生成分類データは無変更。未知親・循環・active子のretired祖先・4段以上を拒否する。未分類を自動作成せず、分類未決の記事はdraft／候補で保留する。将来「その他」が必要なら、説明と整理期限を持った明示的な分類提案とする。

記事URL `/blog/<slug>/` と分類一覧 `/blog/category/<category-slug>/` を維持する。reparentやlabel変更は記事URLも分類URLも変えない。分類slug変更時は旧一覧と全paginationに301、リンク・sitemapを同じPRで更新する。記事slug変更は同じContentIdを維持し、既存route/redirect契約に従う。aliasesは入力の正規化用で、URL redirectを自動成立させない。

タグのID/label/aliasも別管理。既存のNFKC・trim・小文字化による曖昧性検査を維持し、同義語の統合は人が判断する。単なる表記違いはalias、意味の違う近接語は別タグ。unknown IDを自動生成しない。`archive=false`は表示のみ、`archive=true`は公開記事がある時だけ一覧を作る。既存migrationの生成SoTを手編集しない。

## 導線と生成物

- 公開Blogのパンくずは Articles → 主分類の祖先 → 所属分類 → 記事。可視DOMとBreadcrumbListは同じ配列から出す。関連タグはパンくずへ入れない。
- 記事見出し下に「主分類」と「関連タグ」を分けて表示。未公開preview・noindex記事・metadata-onlyタグに、存在しないarchiveへのリンクを作らない。
- 親分類の一覧には子孫の記事を含める。各記事は単一所属で、親への複製登録はしない。分類導線は祖先label付き、タグは別の「関連タグから探す」に置く。空分類を検索エンジン向けに生成しない。
- 本文目次はH2/H3の章内移動で、記事一覧や分類navとは別。現在の長さ／見出し数の生成条件を維持する。
- 検索のtaxonomy textには祖先・所属分類・タグの表示labelを使う。aliasesをキーワードとして水増ししない。関連記事の既存leaf一致／タグ重みは変更しない。
- draft/noindexの除外、RSS最大20、sitemap、各一覧paginationのself canonicalは既存契約を維持。分類追加だけで記事を公開しない。

## SNSカードの比較案

既存XPロゴ、アクセント`#745399`、本文`#15141d`、紙面`#faf9f7`を実ソースから確認。ロゴの形・配色は変更しない。Zenn/Qiitaのレイアウトや装飾は複写しない。

`scripts/social-card-design.mjs`がA（左右の紫の柱）、B（紫の面＋白い本文面）、C（上下の帯）の3案を生成する。いずれも1200×630、XP＋Xpotato.net、所属の短い分類ラベル、見出しを中心に置く。比較用の「工作 / 3Dプリンタ」は未採用の例。A/Cは既存セリフ、Bは既存Zenの見出しで比較する。

中央540pxに必須文字を収め、中央630×630 cropでも保持する。外側の装飾はcropされてよい。通常・長文の日本語見出し、縮小幅390/320px、wide／squareを検査する。他の任意crop・各SNS実機表示は保証しない。見出しは54〜36pxへ測定して調整し、それでも収まらなければ失敗として編集へ戻す。省略や隠れたoverflowで成功にしない。説明文・日付・複数タグはカードへ詰め込まない。

既存ローカルWOFF2（Noto Serif JP / Zen Kaku Gothic New、各OFLとSOURCESを保持）と既存XPだけで描画し、Web画像・外部フォントを取得しない。紙面`#faf9f7`と紫`#745399`のcontrast実測は5.80:1で通常文字の4.5:1を満たす。見た目の最終採用は本人選択後。PNGはローカルQA成果物で、Gitや公開mediaへ登録しない。

crop耐性と小さいサムネイルの可読性は別。長文の42pxは320px幅wide表示で約11.2px、分類22pxは約5.9pxとなる。長い見出しをそのまま最終採用できるとはしない。比較には実寸320pxも添え、採用時は既存の`seo.titleOverride ?? title`を共通SNS見出しとして使う編集方針、またはwide／square別recipeを検討する。短縮版は本文titleとの意味的一致を審査し、自動切捨てしない。

## Heroとsocial card、公開経路

Heroは本文の導入・具体的イメージ、social cardは外部での識別・タイトル可読性。各1点を別roleで登録し、heroをsocial cardへ暗黙fallbackしない。social cardのaltは実際の見出し・分類を短く説明する。生成画像へ文字を描かせず、実metadataからコードで合成する。

既存`packages/media-ingest/src/deterministic-cover.ts`はfontkitで文字をoutline化し、hero2400×1260／social1200×630と生成bindingを作る。`bundled-outline-font.ts`にも固定Zen500・OFL・glyph／hash検証がある。採用後はこれを基にsocial専用profileを版管理し、既存heroの見た目は無断変更しない。A/Cのセリフを採る場合は対応するfont profileも明示する。比較のEdge描画は本番の再現性の証明ではない。

本番rendererはtemplate version、タイトル／分類label、logo hash、font hash、固定fontkit／sharp／Node toolchainをrecipeへ固定し、同一recipeを再利用する。title・分類名・ロゴ・font/template変更でrecipeとpublic object hashを更新。接続口登録時には正規export／validatorでprovenanceの本文・frontmatter identityと対象revisionを照合する。公開URLは既存content-addressed object、Cache-Controlはimmutable。SNS側のキャッシュ更新時刻は制御できない。providerへの生成時fetchは不要。

本差分では通常media contextから、既存compact Registry＋Provenance＋Rights validatorを通ったsocial cardだけをOG/TwitterとJSON-LDへ接続する。full operational receiptやprivate jobをGitへ複製しない。`content-registry/media-evidence/index.ts`は公開安全なcompact記録の接続口で現在は空。mock・権利不成立・recovery exact-set不一致・social_card欠落を拒否する。カードが未登録なら画像metaを作らずTwitter summaryへ縮退する。public social_cardがあるのに証拠がない場合はbuildで停止し、preview画像へfallbackしない。

公開済みの同一画像absolute HTTPS URL・width/height・altをOGとTwitterへ出す。`twitter:site`等のアカウントは本人の確認済み値がないので推測しない。private候補はnoindexを保ち、公開Article／Breadcrumb JSON-LDを抑止する。

実運用完成には、正式な画像生成profileと採用デザインの固定、権利／監査、本物のsource→public→protected保存、compact lineage、登録・PR検証・公開承認・deployが必要。既存live Article Job adapterは未成立で、その制限を解除しない。3D記事はfixtureのまま。今回はprovider resource・資格情報・権限・公開の変更をしない。

## 判断待ちと今回の完了範囲

1. 主分類を単一・通常2段／最大3段とする方針、および現在の記事群をどの棚にまとめるか。新しい棚の名前と既存記事の割当は別の具体的提案で採用する。
2. カードA/B/Cの見た目。採用後に本番renderer/profileを固定する。
3. 本物のmedia公開経路と資格情報は、別途成立・操作認可が必要。

共通基盤と検証は今回実装するが、分類データ移行・新デザイン採用・記事公開・merge/deployは実施しない。検証結果と制限はDraft PRに集約する。
