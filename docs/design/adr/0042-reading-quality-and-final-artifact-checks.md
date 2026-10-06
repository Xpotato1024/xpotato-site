# ADR 0042：読む機能と最終成果物の品質検査を段階追加する

状態：2026-10-06のユーザー依頼に基づく実装方針。PR 65の`8d717b580265c2f9aaab13b8e894727c944dfeb0`から開始します。実装・検証を同じDraft PRの小さなコミットに分けます。本番公開・凍結済み契約の変更承認を含みません。

## 現状と採否

| 項目 | 現状・候補 | 今回の採用と段階 | 理由・境界 |
| --- | --- | --- | --- |
| 操作回帰・axe | Vitestと独自CDPが最終distを検証。Playwright全面移行も可能 | 既存CDPを維持し、axe-core 4.14.0を検証専用に追加。検索読込失敗・異常入力・履歴・開いたメニュー等を補完 | 再ビルドなし、実際のCSP、既存Chrome起動を再利用。まず重大な自動違反を検査し、手動キーボード確認を併用。Playwrightへの段階集約は共通fixtureが必要になる時点で再検討 |
| 記事SEO | canonical/sitemap/RSS/WebPage JSON-LDが実装済み。Figureはまだメディア参照の表示基盤 | BlogPosting/Articleをfrontmatterから派生。公開済みメディアだけの画像解決を安全な関数とfixtureで検証 | 未公開44記事・未登録画像・仮URLを出さない。実メディアrenderer/公開receipt接続が未完のため画像の本番公開は別gate |
| Lighthouse CI | 容量予算と独自LCP/CLS計測がある | @lhci/cli 0.15.1による少数公開routeの補助レポート。最終distを読む任意local/CI step、当初nonblocking | 既存予算を置換しない。点数100・揺れるtimingを必須gateにしない。filesystem出力と認可済みGitHub artifactのみ。temporary-public-storage等へのuploadを呼ばない |
| 長文の目次・節リンク | Astro renderのheadingsを未利用 | H2/H3を使う静的目次と節リンク。本文が長く複数節ある場合だけ表示 | 重複・日本語IDはAstro生成値をそのまま参照。読書位置tracking/常駐JSなし。非stickyヘッダーでも移動先余白・キーボードを確認 |
| fragment検査 | Phase 8が同サイトのページ存在を検査 | 最終HTMLのIDと#fragmentの存在を追加検査。公開可能な外部リンクだけの任意検査用inventoryも生成 | 相対・同ページ・URLエンコードに対応。外部通信は通常buildへ入れず、403/429は要確認として扱う。lycheeは任意の別実行候補で、private URLを渡さない |
| 数式 | portable MDXは任意JSX/HTMLを禁止。CSPもstyle属性を禁止 | fenced `math`のビルド時MathMLを小さい記法として比較・採用候補にする。KaTeX 0.19.0のmathml出力、trust=false、strict/error・展開/入力上限 | HTML版KaTeXのstyle属性や専用フォント配信を避ける。未公開fixtureで分数・行列・式変形・横長式・印刷を確認してから実装状態を記録。生のMathML/任意HTMLの許可は追加しない |
| 記事・教材の印刷 | 通常画面CSSのみ | 内容ページの印刷CSS。ナビ・コピー操作を隠し、白背景、折返し、図表・数式、閉じたdetailsの本文を保持 | PDFサービス不要。長いcode/図を一律break-inside:avoidで紙面から失わせない。ブラウザー印刷エミュレーション・PDFで確認 |

## 実装順と受け入れ条件

1. このADRと現在の参照仕様に採否・境界を記録し、リンクを共有する。
2. 最終distの操作・axe検査を追加する。検査依存を閲覧者へ配信せず、検査自身のfixtureで検出能力を確認する。自動検査をWCAG全体の適合認定とは呼ばない。
3. 記事SEO、目次、fragment検査を接続する。frontmatterの著者・日付を使い、noindex/previewでは記事の公開用JSON-LDを出さない。共通WebPageは維持し、JSONのscript終端を安全にエスケープする。画像はregistry・権利・実際のpublication/protectionの一致が確認できるものだけ。
4. 数式を非公開の合成教材fixtureで比較する。生成MathMLには実行script・style属性・リンク・外部参照を許可しない。CSPやportable MDXの任意表現禁止を緩めず、対応外入力はビルドを失敗させる。
5. 印刷とLighthouse CI補助レポートを追加する。公開distと非公開fixtureを混同せず、外部report uploadなし。前後の転送量・JS・LCP/CLS、PC/mobile/WebKit、印刷を確認する。
6. 同じDraft PRへ段階commit/pushし、最後の正確なheadのCIを確認する。Tailscaleの所有済みレビューserverだけを更新する。

## 維持・見送り

- MiniSearch 7.2.0と日本語bigramを維持。PagefindはADR 0016で日本語分割課題により不採用済みで、今回は再導入しません。
- Shikiは採用済み。ExpressiveCodeはdiff等の明確な必要まで保留。
- Astro Imageへの全面置換は、既存Sharp/variant manifestと再現性を尊重して見送り。
- Analyticsはthird-party script・プライバシー・外部設定を別判断とし、追加しません。
- フォームが未実装なのでTurnstileを追加しません。
- TS strict、Content Collections、Vitest、CSP、既存UIは維持します。検索URLの配信差はADR 0041の本番レビュー事項のままです。

## 保守・ライセンス・一次資料

2026-10-06に公式資料とnpm metadataを確認しました。新依存はexact versionとroot lockへ固定し、license・生成/検証用途を記録します。axe-coreはMPL-2.0、Lighthouse CIはApache-2.0、KaTeXとHAST変換補助はMITです。検証ツールのライセンスはブラウザー配信物へ混在させません。必要以上の依存更新は行いません。

- [axe-core公式リポジトリー](https://github.com/dequelabs/axe-core)・[API](https://www.deque.com/axe/core-documentation/api-documentation/)
- [Lighthouse CI設定](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)：filesystemと公開uploadの違い
- [Astro render/headings](https://docs.astro.build/en/reference/modules/astro-content/#render)
- [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)・[Schema.org BlogPosting](https://schema.org/BlogPosting)
- [KaTeX出力・安全性options](https://katex.org/docs/options)・[ライセンス](https://github.com/KaTeX/KaTeX/blob/main/LICENSE)

## 残るgate

実機の数式読み上げ・Safariの見た目、公開メディアのreceipt/renderer接続、保留記事の公開、外部リンク到達性の継続観測、field/CDN性能は別確認です。外部アカウント・鍵・権限・DNS・R2・merge・deployを変更しません。

## 第1段階の結果

既存CDPへaxe-coreを追加し、ツールの無効入力・結果保持、検索読込失敗と再試行、コピーの実際の内容・成功リセット・正直な失敗を確認しました。axeの検出能力も名前のない合成ボタンで確認しています。ホームのカルーセル番号の表示（01）と読み上げ名（1）の不一致を検出し、読み上げ名にも表示番号を含めて修正しました。CSPや操作UIの見た目は変更していません。

## 読む機能の実装と検証

- Article/BlogPosting は公開可能な notes/blog のみ。日付は既存 frontmatter、著者は現行スキーマに著者欄がないため既存 siteConfig の publisher を使用します。任意の更新日や新しい著者は作りません。画像は rights・publication・protection の照合関数と合成 fixture の段階で、実メディアの接続前は省略します。
- 目次は本文1200文字以上かつH2が3件以上の場合にH2/H3を表示。Astroが生成した日本語・重複IDをそのまま参照します。目次と節番号は検索本文から除外します。
- Astro 7 の既定 Sätteri は remarkPlugins を適用しないため、MDXだけを公式 `@astrojs/markdown-remark` 7.3.1（MIT）の Unified processor に接続しました。通常 Markdown の processor と既存 Shiki 設定は維持します。`math` fence の `label="説明"` を必須にし、横長式には `print="source"` を指定できます。160文字を超える式も印刷では折返せるTeX原文に切り替えます。通常組版の数式を任意の位置で自動改行する機能は提供しません。
- 非公開・noindex の合成 fixture で、分数・行列・式変形・横長式の4件が実際のMathMLになり、style属性が出ないことを確認。EdgeとWindows WebKitの1487/820/390/320pxで横溢れなし、節リンクの移動先が固定ヘッダーと重ならないことを確認しました。実機Safari・音声読み上げの証明ではありません。
- Edgeの印刷CSSとA4 PDF（16ページ）で、閉じたDetailsの本文、合成図、220行すべてのコード印を確認しました。PDF抽出は字体・改ページの視覚品質を保証しないため印刷レイアウトの画面確認も併用します。PDFサービスへの送信はありません。
- 外部リンクは `XPOTATO_LINK_REPORT=<task temp子ディレクトリ> npm run external-links:report` で公開HTMLのqueryなしHTTPSリンクだけを列挙します。任意のlychee 0.24.2（MIT/Apache-2.0、公式配布digest照合済み）検査はprivate/link-local/loopbackを除外し、2026-10-06の8件は成功。通常buildはネットワーク検査を行わず、403/429は要確認として扱います。
- `XPOTATO_LIGHTHOUSE_REPORT=<task temp子ディレクトリ> npm run quality:lighthouse` は同じ公開distの3routeをcollectのみで検査します。再ビルド・公開upload・点数assertionはありません。CIはcontinue-on-errorの補助結果とし、既存容量予算・LCP/CLS・axeを置き換えません。

依存監査には既存Astroを含む指摘とLHCIの推移依存の指摘が残っています。LHCIは信頼済みlocal distのcollect専用で、外部report serverや任意設定入力を受けずブラウザー配信もしません。全依存の監査解消とは主張せず、フレームワーク全体の更新は別判断とします。
