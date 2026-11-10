# 表示と構造の役割

対象はサイト側の部品整理です。全面的な見た目の変更や、独立ツールの内部実装変更ではありません。現行の色・書体・写真・余白・記事の読み順を保ち、同じ役割の操作だけを共通化します。

## 正本と責任範囲

- 実行値の正本は [global.css](../../apps/site/src/styles/global.css) のCSS custom propertiesです。
- [役割台帳](../../apps/site/src/styles/design-roles.json) は、役割、所有者、実装ファイル、比較するcomputed property、対象route・状態、例外の理由を記録します。色や寸法の第二の正本にはしません。
- 現行の構成・読み方は [ビジュアル参照](visual-design-reference.md)、過去の比較は [履歴](../history/visual-design-reference-20261006.md) に分けます。
- 検査は [source契約](../../apps/site/src/styles/design-roles.test.ts) と [最終distの横断検査](../../tools/qa/design-role-interaction.mjs) を使います。台帳への記載だけでは検証済みになりません。

## 折りたたみ

`Details`、オフライン案内、ライセンス・配布情報、記事の関連タグ、問い合わせのJavaScriptなし導線は、同じ「内容を開閉する文字ラベル」です。`.disclosure-summary` で書体・文字サイズ・太さ・行高・上下余白・最小操作領域・focus輪郭を共有します。native details/summaryのクリック、Enter/Space、開閉状態はそのまま使い、追加のJavaScriptや独自roleは付けません。

閉じたラベルと開いた後の補足本文は別の役割です。補足本文の小さな文字や行間、段落余白をsummaryへ継承させません。route全体のsummaryを一括上書きする規則は使わず、部品が明示的に参加します。本文中の未指定summaryに残る最低限の余白は、この明示クラスを除外します。

Prime本体は独立ツールの公開 `--bt-*` APIを介して同じ文字と最小操作領域を受け取ります。新しい公開 `--bt-summary-padding-block` は上下余白を受け取り、open後の本文余白はtool所有のままです。固定版で未提供のAPIをprivate selectorで上書きしません。ナビゲーションの2線メニューは文字の補足ではないため、専用のglyph・motion・focus復帰検査を保ちます。

## 線と状態

| 役割 | token | 使用原則 |
| --- | --- | --- |
| 内容の区切り | `--border-divider` | 記事ヘッダー、関連リスト、タグ、ツールの補足境界。操作の識別を担わせない。 |
| 入力の境界 | `--border-control` | 検索入力、問い合わせselect、共有URL入力。背景から識別できる濃さを保つ。 |
| 独立ツールの境界 | `--border-tool` | 現在の固定版APIへのbridge。入力と区切りの兼用は下記例外。 |
| 強調・focus・状態 | `--accent`、`--focus`、部品の状態色 | 区切りの代用にしない。文字・アイコン・状態の説明を伴う。 |

`--border` の互換aliasは全site-owned sourceから移行して撤去しました。区切りは `--border-divider`、サムネイルの下地や操作の淡い背景は `--surface-muted` とし、同じ色でも用途を分けます。sectionの分離は先に余白を使い、線を追加する場合はその役割と隣接部品の線を確認します。補足領域の上線は領域間の境界、summary自体は枠なしとし、二重の囲みやカードを増やしません。

現在のPrime v0.2.5は、入力・結果・details・dialogに同じ `--bt-border` を使います。値を薄くすると入力の識別性も変わるため、濃い値を残します。分離する場合は独立sourceでcontrol/divider APIを設け、releaseを検証し、正式installerで新しい固定版を採用します。vendor・生成wrapper・lockの手編集は禁止です。

## 見出しと意図的な違い

見出しlevelは見た目の大きさではなく内容の階層で決めます。primary Toolの既存titleは、画面上のページ名を重複させずに見出し移動できるよう、視覚非表示のh2として保持します。固定版の「使い方・ヘルプ」h3はその子に位置づけ、vendorの要素を外から書き換えません。inline Demoではh2を表示します。オフライン案内の各手順はページh1の下のh2です。summaryは親見出しの代わりにせず、操作ラベルとして保持します。補足の小さなsans文字は維持し、通常の記事h2装飾を無差別に適用しません。

以下を数値差だけで欠陥にしません。

- 記事のserif見出しと、UI・ツール・補足のsans。
- archiveカードh2とhomeカードh3、問い合わせの主メールと副領域。
- 共有ブランドアイコン、保存ボタン、円形carousel、暗色codeのコピー操作。
- 写真上の前景、通常headerのglass、暗色code、印刷。
- 内容が収まる位置で選んだbreakpoint、記事と一覧の幅、reduced-motionで停止する別種の遷移。

例外は台帳で所有者・範囲・理由を持ちます。「例外だから検査しない」ではなく、共通比較から除くpropertyと個別の検査を区別します。

## 回帰検査と変更時の確認

source契約は全site-owned summaryの明示参加、tokenの存在と利用、例外の参照、オフライン見出し、vendor境界を確認します。さらに [全体棚卸し](../../apps/site/src/styles/design-inventory.json) と [追加検出](../../apps/site/src/styles/design-inventory.test.ts) が、全テンプレート・CSS・実行時DOM生成の所有と変更を検査します。最終distの横断検査は、実routeのcomputed値、開閉・キーボードfocus・文字拡大・狭幅、入力枠と区切り、見出し順を検査します。一般Detailsは既存Notesの実routeでも確認します。inline Demoと配布情報の埋め込みは、記事と同じCSS条件で作る一時fixtureとsource契約を組み合わせます。fixtureを公開contentへ保存しません。

`release:interaction` は既存の検索・carousel・header・contact・Prime・PWA・アクセシビリティ検査を維持し、この横断検査を加えます。全体のwidth/state matrixと結果は同じ検証出力へ保存します。PNGの保存だけで意匠PASSとせず、該当画像を見て行の折返し・文字の主従・余白・枠の重なりを確認します。desktop Chromeの文字拡大検査は実機mobileやscreen readerの検証とは区別します。

新しい部品や例外を追加したら、同じ役割の既存部品と比較し、台帳・source契約・必要な実表示検査を同時に更新します。tokenを増やすこと自体を目的にせず、単独部品の固有値や過去の比較記録は役割に応じて残します。不要CSSは全source・fixtureの依存を確認してから除去し、履歴を現在の仕様へ戻さないようにします。

## 全体の棚卸しと共通化の境界

台帳は折りたたみだけでなく、次の所有単位を扱います。全sourceは少なくとも一つの役割へ所属させ、数値の一致だけで同じ部品と判断しません。

| 所有単位 | 共通にするもの | 局所に残すもの |
| --- | --- | --- |
| サイトの書体・幅・focus | body/display/mono/meta、content幅・gutter、通常focus輪郭 | 見出し階層、ブランド文字、各routeの本文幅 |
| 入力 | `.control-field` の境界・前景・背景・最小領域 | select・検索・共有URLのpadding、文字サイズ、角丸 |
| 主操作 | `.action-primary` のaccent/on-accentと最小領域 | 検索と保存の文字の強さ・密度、保存中/無効状態 |
| 補足の開閉 | `.disclosure-summary` | メニューglyph、固定toolが公開していないpadding |
| 状態・補助表示 | `.visually-hidden`、意味上のstatus/aria-live | 共有feedback、コード成功/失敗、保存の案内内容 |
| 一覧・発見 | ArticleCard、検索・タグの部品、divider | カードh2/h3、画像の幅、件数・選択状態 |
| 本文・意味付きmodule | prose、見出し装飾、Callout/Steps/Diagnostic/Gallery等の所有 | 単独moduleの構造・余白。未使用variantを無理に装飾しない |
| media・数式・コード | 登録mediaの表示経路、mono、局所overflow | 画像比率、数式原文、暗色codeと構文色 |
| Home・carousel | 同じSite shellと記事カード | 写真の暗幕、白い前景、固定icon寸法、自動送りとreduced-motion |
| 問い合わせ・共有 | 共通field・操作領域・focus | 主メールの主従、SNSブランド、共有の大きな正方形 |
| 独立tool | Demoの公開CSS API bridge | 固定vendor/生成wrapper、release、入力非送信・PWA境界 |
| font配信・印刷 | 既存生成/配信契約 | unicode-range、印刷の単色・改ページ・操作非表示 |

文字付き操作の最小領域は `--control-min-size` で文字拡大に追従し、icon操作の幾何は `--control-icon-size` で保持します。carouselのdot幅、共有ブランド領域、暗いcodeのfocusなどは同じ寸法に潰しません。これらの例外は台帳の `properties` と `checks` で、共有比較から除くpropertyと個別検査を結びます。例外IDの重複・未使用・未定義参照を許可しません。

## 追加・変更を見落とさない手順

1. `npm run design:inventory:check` で現在の構造と照合します。通常の `npm test` にも同じ検査が入っています。
2. Astro AST、CSS parser、TypeScript ASTから、templateの要素/variantと個数、selector、media/supports、propertyのtoken利用/局所値、DOM生成・class操作を収集します。新しいファイルも探索し、既存台帳のsource一覧だけを信頼しません。HTML文字列の連結は断片として検出し、完全なDOM解析と偽りません。
3. 差分を既存の役割へ移すか、役割・例外の所有者/理由/個別検査を追加します。`design:inventory:write` はレビュー後の構造記録の更新であり、自動承認ではありません。
4. 対象routeまたはprivate fixtureのcomputed値・状態・reflowと必要な既存suiteを検証します。共通field・action・typography・statusは台帳の `browserCoverage` にある14 routeとPC/狭幅/文字拡大で横断検査し、従来の6条件のdisclosure検査も保ちます。

棚卸しはCSS値の第二の正本ではなく、値そのものを複製しません。同じselectorの局所値の変更は通常diff・computed検査・画像確認で判断します。本文MDXの内容、固定vendor、画像bytes、生成font値、private authoring画面のすべてをこの検査で保証するものではありません。本文は既存module契約、vendorはinstaller/lock/専用操作suite、private authoringはisolation suiteが担当します。台帳の全sourceに実表示PASSを与えず、未使用moduleの新variantは利用routeまたはprivate fixtureで追加確認します。

Tailwindのutility探索から、棚卸し・役割台帳JSONと本文 `src/content/` を除外します。記録や記事中の `shadow` などの単語をUI classとして配布CSSへ追加しません。本文は既存のcontent module契約に従い、Tailwind utilityを直接所有しません。実際のtemplate・component・runtimeの探索は維持し、CSS容量予算も変更しません。

## 削除と保持の根拠

- 撤去: `--border` aliasと利用箇所。色は変えずdivider/淡い背景へ役割を分離しました。
- 撤去: 現行DOM、runtime generator、検査fixtureに参照のない旧Homeの `.intro-links`、`.intro-description`、`.home-kicker`、`.home-intro-with-photo`、`.intro-break`。現在の写真ヒーロー・3行の見出し・`.record-links` は維持します。
- 共通化: carouselとcodeコピーの読み上げ専用statusを `.visually-hidden` へ移し、同じ非表示CSSのコピーを撤去しました。status名とaria-live、印刷時の扱いは残します。
- 保持: `content.css` の旧Prime title/section/result、汎用form/output。`packages/site-validators/fixtures/LegacyPrimeFactorizer.tsx` の歴史復元fixtureが依存しているためです。現行vendor用APIと混同しません。
- 保持: 過去のdesign/監査文書。採用済みの凍結本文や過去の計測は現行仕様へ書き換えず、現行参照から区別します。

## ツールの役割別API追加（実装候補）

Demoは `--bt-border-control` → `--border-control`、`--bt-border-divider` → `--border-divider`、`--bt-summary-padding-block` → `--disclosure-padding-block` を渡します。旧 `--bt-border` → `--border-tool` は固定Prime v0.2.5互換のため維持します。新規tool雛形は役割別APIと旧値へのfallbackを実装し、CSSが単体・旧host・新hostで成立する契約を検査します。新token追加はruntime capability、release pin、公開許可を変更しません。

Primeの独立sourceへの実装と、正式releaseをinstallerで採用する段階は別です。このsite変更だけではv0.2.5の線や余白は変わらず、台帳の固定版例外も未解消として残します。
