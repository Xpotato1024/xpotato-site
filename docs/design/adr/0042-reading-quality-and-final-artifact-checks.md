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
