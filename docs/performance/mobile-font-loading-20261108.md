# ホームのフォント配信改善（2026-11-08）

Draft PR158の `907e8e8c11bfe33889c1a00f02a8f7cd4ef65bc8` を基点とする独立した候補。PR158のブランチと作業領域は変更しない。画像・構図・色・余白・書体・文字サイズ・太さ・`font-display: swap` は維持する。本番配信やPR158の採用を意味しない。

## 変更と判断

- 2026-10-05の統合フォント集合に、基準の公開ホームから不足していたNoto Serif JPの4文字、Zen Kaku Gothic Newの32文字を追加した。保留記事、非公開fixture、入力された検索語や計算結果は収集していない。以前の実在するglyphはすべて保持する。
- 同じfamily・weight・style・stretchの統合フォントが必要文字をすべて供給する場合だけ、重複する元の分割フォント定義を省く。元の定義同士では省略判定をしない。残す定義のUnicode範囲、順序、binaryは変更しない。新しい記事・動的UI・検索corpusの文字には従来の分割フォントを引き続き選ぶ。
- ホームの小さくなったフォントCSSだけをHTMLに含め、描画を待たせる追加CSS取得を1件減らす。他のルートは内容hash付きの外部CSSとキャッシュを維持する。既存のpublication compilerがinline styleのCSP hashを生成する。`unsafe-inline`などの許可拡大はない。
- CSS予算はinlineの`style`要素も含めて集計する。既存のraw 100,000 / gzip 32,000 bytes上限は変更しない。統合フォントの検査はsourceだけでなく最終distの実bytesも照合する。
- Zenの500weight preloadを外す案は、予備比較で初期文字表示が遅くなったため採用しない。四つの統合フォントpreloadを維持する。

元の分割ファイル、OFL、以前の統合フォントは保持する。新しいbytesには新しいhash名を使い、同じ名前の内容は上書きしない。

## フォント再生成

CPython 3.12.15 Windows x64、固定FontTools 4.66.1 / Brotli 1.2.0を独立したローカル環境で使用した。通常のnpm buildとCIにPythonは追加しない。

1. 変更前の`generate-font-core.py`で元の4フォントがバイト一致することを確認。
2. レビュー済み公開ホームの文字を既存の`core-input-v1.json`へ統合し、`python tools/assets/generate-font-core.py --write`で生成。
3. `--write`なしで新しい4フォントの再現を確認。
4. 全1,398 glyphの輪郭、advance、unitsPerEmを以前の統合フォントまたは元の分割ファイルと照合し一致を確認。

4フォントの合計は168,168→175,544 bytes。統合ファイル自体は7,376 bytes増えるが、ホームで追加取得していた多数の分割ファイルを減らす。Latinの95 glyphは不変、JPは197→201、Zenの各weightは519→551。

旧入力にはCR/LFと、元の入力cmapに存在しないU+2197が含まれていた。実在しない3点を要求集合から除いたが、実在するglyphは削除していない。矢印に対する従来の分割ファイル選択・system fallbackは保持する。生成器は今後、要求された通常文字が入力cmapにない場合に停止する。

輪郭一致だけではkerning、合字、読み込み途中の表示を検証したことにはならない。ブラウザー比較は別に行う。統合フォントの取得が失敗したとき、省略した旧定義による救済はなくなるため、system fallbackで文字と操作を利用できることを確認する。

## 比較方法と公開境界

基準artifactの全493ローカルファイルを`_publication.json`と照合し、source SHAが上記基準と一致することを確認した。同じWindows Edge、Node、Lighthouse、ローカルgzip配信、cache reset、mobile simulated throttleで交互に測る。重いビルド・テストと性能計測は重ねない。

予備比較では各2回、統合だけ・ホームCSS inline・500weight preload削減を分けて測定した。最終数値と検証結果は、この変更のDraft PRと対応する測定JSONを参照する。予備結果を最終headの結果に置き換えて扱わない。

ローカルlabであり、公開PSI、CDN、field p75、INP、実機iOSの改善を示す値ではない。push/PR起点の配信はなく、Ready for Review、merge、deploy、release、provider操作、端末設定・資格情報変更は行わない。
