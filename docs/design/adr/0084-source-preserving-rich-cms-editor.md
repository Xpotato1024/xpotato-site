---
status: accepted
owner: architecture
last_verified: 2026-11-18
---

# ADR-0084: 原文を保持するリッチ編集とCMS専用runtime予算

## 背景

利用者は、段落内の装飾・リンク、引用・入れ子のリスト・表、画像グリッド、手順、TeX数式をCMSで組み立て、本文を見ながらブロックを動かせる実装を依頼した。従来のtextareaと部品名の選択肢だけでは、これらの編集とモバイルの入力を一体に扱えない。自作contenteditableでIME・選択範囲・入れ子・履歴を再実装すると、原稿の欠落とフォーカス移動の原因を増やす。

一方、MDX全体を一般的なリッチエディタで読み書きすると、未編集の記法や空白まで正規化され、未知の部品や将来の構文が消える恐れがある。永続形式は引き続きportable MDXとregistryである。

## 判断

通常の文章領域にはMDXEditor 4.5.0とLexical 0.48.0、MDX本文のソース編集にはCodeMirror 6を使う。リッチエディタの初期正規化を原稿へ書き戻さず、実際に変更した領域だけを置換する。領域には操作中に安定したIDを与え、段落の追加・日本語入力・移動を原因に入力要素を作り直さない。対応できない構文は原文を保持したMDX入力へ切り替える。

semantic moduleの項目は共有スキーマから生成する。親要素の属性をASTから読み、子の属性を混ぜない。親の設定変更では開始タグだけを更新し、子の本文と空白を保持する。Gallery・Steps・Details等の中身は同じ領域編集を入れ子にする。booleanはbare attribute、Galleryの列数などはliteral stringとして保存する。

装飾・リンク・インラインコードは文字範囲の操作とし、リスト・引用・表は構造の操作、Gallery・Steps等は複合部品の操作とする。ブロック移動は本文内のハンドルで行い、pointerとキーボードの両方で確定・キャンセルできる。添削のsource offsetは選択文字列が原文に一意に対応するときだけ返し、それ以外は引用とブロック範囲を返す。

数式は公開サイトと同じ`math` fenceと必須の`label`を使う。KaTeX 0.19.0のMathML出力、`trust:false`、`strict:error`、展開回数100、最大寸法8、入力4096文字と禁止マクロを編集時にも適用する。`tex`・`latex`言語の通常コードは数式へ勝手に変換しない。MathMLなので編集画面にも数式専用フォントやinline styleの許可を追加しない。

CodeMirrorのテーマはopen ShadowRoot内のconstructed stylesheetを使う。CMSのCSPに`unsafe-inline`や固定nonceを追加しない。通常公開ページへCMSのruntimeを持ち込まない。

## 読み込みと予算

リッチ編集、MDXソース編集、数式、サイトプレビューは必要時に読み込む。React本体と`@lexical/react`・Radixを同じ名前一致でまとめない。Viteのpreload helperも小さい専用chunkへ置く。helperが大きな遅延chunkへ入ると、初期画面からそのchunk全体が必要になるためである。

2026-11-18のproduction editor buildを、既存の`measureRouteRuntime`と追加の`measureEditorInitialRuntime`で計測した。rawは配布JSのbyte数、gzipはファイルごとのNode gzipを加算した値であり、実端末の待ち時間や通信量の実測ではない。

| 対象 | raw bytes | gzip bytes |
| --- | ---: | ---: |
| 従来CMSの記録された全graph | 866,490 | 未記録 |
| リッチ編集導入後の全graph | 2,867,269 | 920,422 |
| 初期画面のgraph | 974,310 | 298,791 |
| 必要時に読み込むgraph | 1,892,959 | 621,631 |

全graphにはdynamic importも引き続き含める。CMS専用の上限をraw 3,400,000 bytes／gzip 1,100,000 bytesとする。上記計測に対して約19〜20%の余裕で、機能追加が無制限に増える扱いにはしない。従来のraw 1,000,000 bytes／gzip 320,000 bytesは、新設する初期画面の上限として維持する。script、modulepreload、静的import/exportをたどり、初期chunkへ重い依存が戻った場合も検出する。

公開記事、検索、ツール、共有メニュー、CSS等の既存上限は変更しない。CMS用上限の変更で通常公開ページのruntime混入を許可しない。今後は全graphと初期graphの両方を満たし、必要な依存変更には新しい計測と理由を残す。

## 配信後照合の件数予算

CMSのプレビューは本文が今後変わっても公開サイトと同じ日本語フォントを表示できるよう、サイトのunicode-range付き367 subsetと編集画面用core 4個を同梱する。文字ごとの遅延読込とPWA cacheの内容照合を維持し、初期画面で371個を一括取得しない。

この追加で、commit `470ad39d740827247513a8c13d4e008340654493` のsite/editor build、search/PWA生成物と既存media registryから導く配信照合計画は677対象・64,954,353 bytesになり、CI run `44341933441` の通常publication compilerが従来の512対象上限で停止した。内訳はCMS font 371、CMS runtime等18、サイトCSS/JS 47、その他サイト資産88、既存の正規外部画像153である。これはファイルと登録bytesの計測であり、本番GETや配信成功の記録ではない。

全てのfontをpath/size/hashで照合するため、件数上限を768、factory全体のGET上限を `2 × 768 + before 3 + after 2 = 1541` に更新する。現在の677件に対して91件、約13%の余裕を持たせる。対象総量64MiB、実観測総量138MiB、通常の個別body 2MiB（既存Prime chunkだけ6MB）、全体120秒、1要求10秒、最大3観測は変更しない。3回目は残余予算内の不一致だけを扱い、期限内の完了を保証しない。対象の省略やhash検証の免除は行わず、超過は引き続き通常CIで失敗する。

ADR-0064の512対象/1029GETは導入時の記録であり、以後の件数はこの変更を反映した共有policyを使う。変更はアプリケーション内部の有限な照合件数だけで、provider quota、資格情報、公開権限、配信の起動・承認条件は維持する。

## 検証と制約

既存の全content collectionの本文についてbyte単位の無変更round tripを確認する。部分置換、CRLF保持、任意位置への移動、親子属性の分離、booleanの保存、未知構文の保持、source anchorの曖昧性を回帰テストにする。初期graphの検査は遅延import・modulepreload・許可graph外の資源をfixtureで検証する。

ブラウザー用チェックは、リッチ編集の無変更focus、カーソル位置、装飾範囲、pointer／キーボード移動、親子部品、数式、言語指定、390pxでの折り返し、IndexedDB復元、offline shell、CSPを対象にする。既存の認証・Git競合・私有画像同期・Astro reviewのチェックを残す。テスト定義やbuild成功は、ブラウザーで実行された証拠の代わりにはしない。

本ADRは実装方式の採用であり、本番公開・PR承認・deployの実施記録ではない。
