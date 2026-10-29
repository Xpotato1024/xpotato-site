---
status: proposed
owner: content
last_verified: 2026-10-29
---

# Blog標準SNSカード C

2026-10-29の本人選択でC（上下の紫帯・セリフ見出し）を採用した。デザイン選択と記事・画像の公開承認は別。PR123で生成基盤を整備し、merge・deploy・記事公開は行わない。A/Bは比較履歴だけで、通常生成のstyle選択肢にはしない。

## 記事単位の入力

Blogの元の一行titleを画像の見出しとして使う。SEO titleOverrideは画像へ適用しない。任意cardDisplay.linesは元titleを意味単位に区切る表示専用text配列であり、内容の追加・削除・HTML・URL・任意styleを受け付けない。titleやSEOへ改行記号を書き戻さない。schemaは文字一致・禁則・書記素とLatin token境界を検査し、容量と字形の有無は実フォントで生成するときに検証する。

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "title": "安全な設計を小さく試す",
  "description": "ローカル生成の検証例。",
  "pubDate": "2026-10-29",
  "category": "software",
  "tags": [],
  "draft": true,
  "cardDisplay": {"lines": ["安全な設計を", "小さく試す"]}
}
```

categoryは既存Registryのactive IDを使用。標準のラベルは所属分類の短いleaf labelで、タグ・日付は載せない。比較画像の「工作 / 3Dプリンタ」は分類未採用の例であり、分類データを自動追加しない。未知分類・幅超過のラベルは拒否する。分類階層の変更は別の編集判断。

## 固定された生成

profileはxpotato-blog-social-c-v1。1200×630、紙面#faf9f7、紫#745399、元XPロゴ、Noto Serif JP 400の見出し、Zen Kaku Gothic New 500のブランド・分類、400のfooterを使う。既存OFLフォントの全subset・license・CSSを検証し、文字が無ければ停止する。描画する文字だけNFCに正規化しfontkitでshapingする。元title・line・bindingは入力を保持する。合成可能な結合文字とkerningを処理し、SVGはoutlineのみ。OSフォント・外部fetch・代替字形に依存しない。

元Cの見出し左330・上203・幅540、54〜48px・行間1.25を保持。divider上に12pxの字形余白を確保し、Cの収容上限は4行・291px高。Blog schemaも最大4行とし、容量不足はCARD_TITLE_CANNOT_FITとなる。字形の実boundsも検査し、切り捨て・ellipsis・過度な小文字化・overflow隠しをしない。NFCでも合成されない結合markはCARD_COMBINING_GLYPH_UNSUPPORTEDで拒否し、不正な位置へ描画しない。自動改行は日本語の意味を完全に判定するものではなく、必要なら編集者がlinesを指定する。

recipeはContentId、元title hash、分類label、表示指定、配置、profile、rendererとlayout/shapingの実装hash、ロゴ固定hash、3fontのmanifest/license、Node/ICU/Unicode、fontkit、Sharpの全toolchain hashを束ねる。同じrecipeとtoolchainは同じSVG/PNGを再生成する。異なるtoolchainのbytes一致は主張しない。タイトル・指定・分類・font・ロゴ・実装を変えたらrecipeと生成物hashが変わり、既存の候補を無断で更新しない。旧planはVISUAL_GENERATOR_CHANGED等の既存freshness検査で停止し、再候補化・監査・必要な本人承認へ戻る。

## ローカル生成と公開まで

```text
npm run social-card:preview -- --input <Blog frontmatter JSON>
```

出力は.local/blog-social-cards/ContentId/preparation-hash/。preparationは画像recipeとfrontmatterのhashを束ね、説明やSEOだけ更新しても古い入力receiptへ上書きしない。画像に関係しないmetadataの更新ではPNG hashを維持する。social.svg、social.png、canonical master、delivery PNG、recipe.jsonを生成する。新しい通常CLIはC固定。公開本文・Registry・Gitへ画像を書かず、権利や公開admissionも作らない。出力先overrideも同じprivate root内に限定し、リンク経由の出力を拒否する。

Article JobではcoverForPlanがsocialだけをCへ置換する。既存heroのbytes・templateは維持する。socialのaltは実titleとサイト名、decorative=false。既存のmasters→独立visual audit→media delivery→候補検査→本人承認→source保存→public保存→protected exact copy→compact provenance/Registry exportを通す。新recipeで既存の承認を流用しない。

ローカルとArticle Jobは同じcanonical lossless WebP処理とsocial-card-v1の1200×630 PNG変換を使い、meta・size・hashを検査する。生成profileとdelivery profileは別で、既存social-card-v1をCのデザインIDとして流用しない。

公開用contentMediaContextは既存compact Registry・provenance・rights・recovery exact-setを検証してから画像を返す。social cardはPNG1200×630・非装飾・非空altを要求し、同じ絶対HTTPS URLをOGとTwitterへ接続する。mock、権利不成立、証跡欠落、role/format/寸法不整合は停止。Registry未接続の画像をpublicフォルダやdata URLから使うfallbackはない。画像が存在しない場合のsummary縮退は従来どおり。

## 検証と残る運用条件

unitで元titleとSEOの分離、表示指定、字形・capacity拒否、SVG/PNG再現、hero維持、公開画像の拒否条件を検査する。scripts/blog-social-card-qa.tsは既存14件に新しい5件を加え、実canonical/delivery経路でCを生成する。実寸・320px縮小・中央squareを画面で確認し、Blog共通テンプレートのOG/Twitterは隔離synthetic projectionで照合する。fixtureの権利・保存証跡を本物の公開admissionと呼ばない。

現在の公開media-evidence接続口は空。実際のsource/public/protected保存とlive Article Job adapter、公開安全なcompact記録、対象記事の内容・画像監査、本人の公開承認と正規deployはまだ必要。C採用だけでこれらは成立しない。3D記事はfixtureのまま。実SNSのfetch・独自crop・cache更新、実機Safariは未検証。Library納品は私的レビュー成果物であり、Web公開mediaの代替ではない。
