---
status: proposed
owner: content
last_verified: 2026-10-29
---

# SNSカードの表示用改行

PR123の未採用A/B/Cの色・構成・XPロゴは保持し、見出しの改行だけを編集できるようにする。現時点の設定入口は `tests/fixtures/blog-foundation/social-card-titles.json` の各カード入力。公開記事のfrontmatter／SEO schemaへの追加や本番生成profileの採用ではない。

```json
{
  "title": "充填率100%なら丈夫になる？ 壊れ方で選ぶ設定",
  "cardDisplay": {
    "lines": ["充填率100%なら", "丈夫になる？", "壊れ方で選ぶ設定"]
  }
}
```

`title`は元の一行文字列のまま。`cardDisplay.lines`は表示専用の文字列配列で、改行記号をtitleへ埋め込まない。各行は元titleの連続した部分でなければならず、行境界の空白を改行へ置換する以外の追加・削除・言い換えを拒否する。英数字tokenの途中、書記素の途中、行末の開き括弧、行頭の閉じ括弧・句読点なども拒否する。任意HTMLは受け取らず、rendererがescape済みtextを既定のspanに入れる。文字列がHTMLに見えても実行しない。カードのaria-labelとAPIが返すtitleは元titleを保持し、canonical titleやSEO titleへ設定を伝播しない。

入力は180書記素まで。空文字、制御文字・書式制御・不正surrogate・Unicode行／段落区切りは `CARD_TITLE_INVALID`、長さ上限は `CARD_TITLE_TOO_LONG` とし、容量不足とは区別する。空白を改行へ置換するときも開始／終了の書記素境界を検査する。`$&`・``$` ``・`$'`・`$1`も通常の文字列であり、保存HTMLの置換callbackで特殊な置換記号として扱わせない。保存したHTMLを再読込し、元title・行配列・h1数・安全な子要素を照合する。

設定がなければIntl.Segmenterの日本語単語境界を候補にし、英数字tokenを保護しつつ行幅を均衡させる。句読点・括弧の禁則と極端な短行を避け、助詞／接尾辞からの行開始にペナルティを設ける。意味を完全に理解した日本語編集とは呼ばず、必要な意味単位は上記の任意指定で確定する。`.NET`等の先頭dotは識別子として許す。

既存の中央540px、最大320px高を保持。実フォントで54／52／50／48pxを測定し、最大5行に収まる場合だけ描画する。48pxより小さくせず、切り捨て・ellipsis・隠れたoverflowを使わない。単語が長すぎる場合や全文が収容不可なら `CARD_TITLE_CANNOT_FIT` として停止する。旧長文stress例はこの拒否例として残し、収まったように表示しない。

回帰入力には実際の3Dタイトル（指定あり／なし）、長短日本語、英語、Node.js／v24.22.1／JSON-LD／C++／C#／UTF-8、括弧、HTML状のliteral、長単語、収容不可長文を含む。unitに加え、A/B/Cごとに1200×630実寸・中央square・320×168縮小を描画する。出力JSONに各行、fontSize、width、height、footerとの距離、拒否結果を記録する。画像が収まることと、すべてのSNS・実端末で読めることは区別する。

再現は `node scripts/social-card-design.mjs`。Libraryの既存比較画像・各案・ZIPは正式なversion付き置換で更新する。今回もブランド案の採用、記事公開、merge、deployは行わない。
