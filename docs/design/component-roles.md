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

Prime本体は独立ツールの公開 `--bt-*` APIを介して同じ文字と最小操作領域を受け取ります。固定版で未提供のpaddingやopen余白のAPIは、private selectorで上書きしません。ナビゲーションの2線メニューは文字の補足ではないため、専用のglyph・motion・focus復帰検査を保ちます。

## 線と状態

| 役割 | token | 使用原則 |
| --- | --- | --- |
| 内容の区切り | `--border-divider` | 記事ヘッダー、関連リスト、タグ、ツールの補足境界。操作の識別を担わせない。 |
| 入力の境界 | `--border-control` | 検索入力、問い合わせselect、共有URL入力。背景から識別できる濃さを保つ。 |
| 独立ツールの境界 | `--border-tool` | 現在の固定版APIへのbridge。入力と区切りの兼用は下記例外。 |
| 強調・focus・状態 | `--accent`、`--focus`、部品の状態色 | 区切りの代用にしない。文字・アイコン・状態の説明を伴う。 |

`--border` は未移行の装飾線・背景を変えないための `--border-divider` 互換aliasです。新しい入力境界へ使いません。sectionの分離は先に余白を使い、線を追加する場合はその役割と隣接部品の線を確認します。補足領域の上線は領域間の境界、summary自体は枠なしとし、二重の囲みやカードを増やしません。

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

source契約は全site-owned summaryの明示参加、tokenの存在と利用、例外の参照、オフライン見出し、vendor境界を確認します。最終distの横断検査は、実routeのcomputed値、開閉・キーボードfocus・文字拡大・狭幅、入力枠と区切り、見出し順を検査します。一般Detailsは既存Notesの実routeでも確認します。inline Demoと配布情報の埋め込みは、記事と同じCSS条件で作る一時fixtureとsource契約を組み合わせます。fixtureを公開contentへ保存しません。

`release:interaction` は既存の検索・carousel・header・contact・Prime・PWA・アクセシビリティ検査を維持し、この横断検査を加えます。全体のwidth/state matrixと結果は同じ検証出力へ保存します。PNGの保存だけで意匠PASSとせず、該当画像を見て行の折返し・文字の主従・余白・枠の重なりを確認します。desktop Chromeの文字拡大検査は実機mobileやscreen readerの検証とは区別します。

新しい部品や例外を追加したら、同じ役割の既存部品と比較し、台帳・source契約・必要な実表示検査を同時に更新します。tokenを増やすこと自体を目的にせず、単独部品の固有値や過去の比較記録は役割に応じて残します。不要CSSは全source・fixtureの依存を確認してから除去し、履歴を現在の仕様へ戻さないようにします。
