---
status: proposed
owner: media
---

# 保留記事 social card の日本語フォント修正候補

PR111 の比較 artifact `12374386354`（run `39661411964`、`security-media-review-111`）にある旧28枚・新28枚は、双方に日本語欠字がある。Qdrant 記事の native PNG で文字コード入りの四角を確認した。対象記事は `held_candidate` であり、この観測から公開サイトの障害は立証しない。記事本文、frontmatter、公開保留、過去の承認記録は変更しない。

## 原因と修正

旧 `blog-social-card-source-v1` は `<text font-family="Noto Sans JP, IBM Plex Sans JP, sans-serif">` という名前指定だけで、フォント bytes を供給していなかった。Sharp/libvips の SVG rasterizer は site の CSS や `/fonts/` を読み込まず、実行環境の代替フォントへ依存していた。日本語グリフがない環境では PNG に欠字が焼き込まれる。文字数だけの21文字×3行の処理には、長い見出しの末尾を省略する別の制限もあった。

新 `blog-social-card-outline-v2` は、既存 Git 同梱の **Zen Kaku Gothic New 500** の full subset 群を使う。公開画面向けの core subset は保留記事の文字を含む保証がないので使わない。追加ダウンロード、OS フォントのインストール、fontconfig 設定は不要。既存 `zenkakugothicnew-OFL.txt`（SIL OFL 1.1）を保持する。

`bundled-outline-font.ts` が `fonts.css` の family/weight/unicode-range を解決し、content-addressed WOFF2 の名前と SHA-256 を検証する。固定 `fontkit@2.0.4` で非ゼロの glyph ID と可視文字の path を確認し、SVG path に変換する。SVG metadata に font manifest、CSS、license hash と layout profile を入れ、その SVG 全体を生成 source hash に束縛する。文字描画に `<text>`、外部参照、OS fallback は残らない。欠字、フォントの欠落・改変、制御文字、収まらない見出しは `CARD_*` エラーで停止する。

見出しは実 advance width で最大4行、58〜32px に収める。英単語境界と基本的な禁則を考慮し、極端に短い最終行を避ける。入力の NFC 正規化・前後空白除去以外は、省略記号の挿入や本文変更をしない。180文字の上限内でも収まらない場合は失敗する。CSS/license の hash は改行を LF に正規化し、Windows checkout と Linux CI の再現性を保つ。この同値性にも回帰テストがある。

## 再現

`.node-version` / `packageManager` の Node 24.22.1 / npm 11.19.0 と lock を使い、repository root から実行する。

```sh
npm ci
npm run schema:check
npx vitest run packages/media-ingest packages/site-validators/src/phase6-media-candidate.test.ts packages/content-contracts/src/contracts.test.ts
npm run migration:media:candidate:check
npm run migration:media:processing:check
node --import tsx scripts/review-held-social-font.ts
```

生成候補を更新する場合だけ `npm run migration:media:candidate` / `npm run migration:media:processing` を使い、差分を確認する。historical acceptance record の hash は当時の観測として保持する。committed processing manifest の正規照合は既存 Ubuntu CI で行う。今回の修正版44 PNG は Windows と Ubuntu で全 SHA が一致した。一方、無関係な既存 inline asset 3件の variant には OS 間の encoder 差があり、Windows の全 manifest を採用するとそれまで変わる。run `39768382752` の Linux candidate artifact `12421521879` と照合し、social card 以外の record が既存 main と一致することを確認して Linux candidate を採用した。Windows の全 processing check はこの既知差を含むため、Ubuntu の正規照合と区別する。

PR111 の元 PNG と比較する場合は、認可済み GitHub CLI で artifact を private `.local` に取得する。

```sh
gh run download 39661411964 --repo Xpotato1024/xpotato-site --name security-media-review-111 --dir .local/pr111-media
node --import tsx scripts/review-held-social-font.ts .local/pr111-media
```

出力は `.local/migration/phase6/social-font-review/`。`index.html` が比較ギャラリー、`fixed/` が44枚の1200×630 PNG、`comparisons/` が28組の縦3枚比較（上=PR111旧版、中=PR111新版、下=修正版）、`contact-*.png` が目視用一覧、`report.json` が source/runtime/画像 SHA と反復生成結果を記録する。元28組の SHA を `expected.json` と照合し、全44件の `held_candidate` を検証する。比較元を指定しない CI artifact は修正版だけであり、PR111 比較済みとは表示しない。PNG を Git に追加しない。

## 検証境界

回帰テストは日本語・漢字・仮名・句読点・英数字混在、63文字を超える見出しの全文保持、幅・実 PNG の ink 範囲、同じ入力からの byte 一致、欠字・overflow・改変フォントの拒否を扱う。通常 CI でも同じテストが動く。Phase 6 workflow は修正版44枚と report を既存 artifact に保持する。

push/PR 前に `deploy-site.yml` の dispatch 専用 trigger と owner/main/Environment/Production-artifact guard を確認した。`current-deployment-status.md` と同じ境界を維持する。今回の CI artifact、画像確認、Draft PR は、記事の承認、hold 解除、media persistence、公開、merge、production deploy を意味しない。公開サイトや provider 側の変更・復旧は未実施。
