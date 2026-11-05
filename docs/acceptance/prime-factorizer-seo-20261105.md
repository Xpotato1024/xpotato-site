# 素因数分解計算機の検索意図・発見導線の改善候補

基点は main `4961025860325f12104d57e6c609243fb85cc9d2`。対象は既存計算機 `/tools/prime-factorizer/`、ContentId `bca48f98-c89a-457f-84d8-168f941fe469`。独立した解説・最適化記事は本人が別途用意する計画を維持する。

## 調査と判断

既存 `.agents/skills/site-seo-review` と `update-site` を確認し、共通 metadata/catalog/layout と既存の編集台帳を利用する。新しいSEO専用fieldや公開経路は増やさない。スキルの汎用化は別の変更として扱う。

2026-11-05 01:49 UTC の通常GETでは次を確認した。検索クローラーの取得・Googleの登録状態を直接観測した結果ではない。

| 対象 | 観測 | 判断 |
|---|---|---|
| 計算機 | 200、HTML 21372 bytes、自己canonical、noindex/meta・X-Robots-Tagなし | 取得時点で一般閲覧を妨げる応答はない |
| 初期HTML | 名称・説明・短い使い方・36の例、WebPage/BreadcrumbListを含む | 検索用の説明にJS実行は不要 |
| robots.txt | 200、2746 bytes、wildcard Allow、Googlebot固有拒否なし | named bot拒否・Cloudflare付加内容は保持。検索結果掲載の保証ではない |
| sitemap | indexと子XMLは200、正規計算機URLを1件掲載 | 現在の生成処理を保持 |
| ツール一覧 | 200、計算機への通常のa hrefを含む | 既存導線を保持 |
| ホーム | 計算機への直接リンクなし | featured済みツールの静的導線を追加 |
| 旧 `/?p=34` | redirectなしの200、ホームと同じ11948 bytes・SHA-256、canonicalはホーム | URL継続の懸念。infra/providerの別作業として残す |

計算機HTMLのSHA-256は `c1f420b9df9544b4541baadda66e70bfd56e042bfc8e64a76b08531142671802`。旧URLとホームのSHA-256は `a6f5555f0dc7b671f1c242ec7750600dc5bcd248f69d228a651dd1fe39f8a6c1`。応答時間の単発測定をCore Web Vitalsや計算速度の証拠として使わない。

同日の検索サービスで「素因数分解 計算」には入力式の計算ページ、「素因数分解 やり方」には学習手順のページが現れた。このサンプルをGoogle順位・検索量の測定とは扱わない。計算意図へは入力→素因数・指数→結果コピーを短く示し、学習意図の長い解説・表・FAQを計算欄へ詰め込まない。

## 変更

- 名称「素因数分解計算機」とURLを保持。直前のPR137の配信から短期間なので、タイトルを繰り返し変更しない。
- descriptionを計算結果の使い方中心に整理し、WebAssembly・並列計算による高速化の特徴も保持する。最速や任意の入力での完了は保証しない。同じ値が本文見出し下・一覧・検索・OG/Twitter・WebPageへ共通導出される。
- 入力前の1段落に「2以上の整数を素数の積に分解」という目的を明記し、既存の36の例と未完了・未証明の補足を保持する。
- ホームに公開・indexable・featuredのツールを最大3件表示する。既存catalogと日付/ID順を使い、通常のa hrefで到達できる。既存の一覧styleを使い、JS・依存・専用CSSは追加しない。0件ならsectionを出さない。
- 編集台帳の本文/frontmatter hashと編集理由を同期。ContentId、公開日、更新日、分類、Demo binding、toolkit pin、入力範囲、CSP、manual deploy条件を維持する。

## 比較して採用しなかった手法

- キーワードの列挙・隠しテキスト・cloaking・偽レビュー・大量被リンク・薄いページ量産は採用しない。可視内容と検索向け表現を一致させる。
- 現行のWebPageと可視パンくずで実体を表せる。SoftwareApplicationのGoogle rich resultには評価/レビューも必要であり、実在しない評価を追加しない。schema追加だけで順位向上を主張しない。
- FAQ schema、llms.txt、検索専用URL量産を今回の効果根拠にしない。専用AI最適化やschemaの種類数を成果指標にしない。
- 旧query URLの転送はmetadataだけで修正できないため、このSite PRではprovider設定を変更しない。

一次資料（2026-11-05確認）:

- [Google title links](https://developers.google.com/search/docs/appearance/title-link): 簡潔で内容に合う名称、再クロール待ちを考慮する。
- [Google snippets](https://developers.google.com/search/docs/appearance/snippet): 検索語に応じ本文またはdescriptionから生成され、表示を固定できない。
- [Google crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable): 関連性のある説明的な通常リンクを用意する。
- [Google software app](https://developers.google.com/search/docs/appearance/structured-data/software-app): Googleの適格性とschemaの構文妥当性を分ける。
- [Google page experience](https://developers.google.com/search/docs/appearance/page-experience): 単一スコアだけで検索順位を判断しない。
- [Google Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start): 登録状況と検索パフォーマンスを別に確認する。

## 検証と残る確認

実施した検証・最終headのCIはDraft PRに記録する。変更後の同じdistでmetadata/JSON-LD/本文/一覧/ホーム/検索/sitemap、公開除外、CSP・性能予算、PC/390px表示と計算操作を確認する。スクリーンショットは作業成果物としGitへ追加しない。

Search ConsoleのURL検査・選択canonical・最終クロール・登録状態・検索query別表示回数/クリック/CTR/平均掲載順位は未確認。直前の変更が未反映なだけの可能性もあり、未登録・順位低下・その原因を断定しない。本人が別途配信した後、最終クロール日を確認し、「素因数分解」「素因数分解 計算」「素因数分解機」をページ・国・デバイス条件を揃えて週単位で比較する。十分な表示回数がなければCTRの変化を結論にしない。

本PRはmerge、Ready for Review、本番配信、旧記事の公開、Search Console変更・再登録依頼、外部宣伝投稿を実施しない。旧URL転送と本番反映後の検索成果は別工程。
