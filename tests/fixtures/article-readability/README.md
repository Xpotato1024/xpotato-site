# 記事の可読性確認用fixture

正式な記事登録・公開ではなく、synthetic_fixtureとしてprivate candidate描画を確認する。
元の3Dプリンタ記事で扱った外周・内部密度、積層方向、破損の切り分け、条件、出典を保持し、今回の監査に基づいて改稿した原稿。以前の短縮版とは同一原稿と呼ばない。
CSS比較ではこのMDXと同梱SVGを変更せず使う。本文改稿時は本文変更としてレビューし、図・出典を黙って削らない。
SVGは自作の説明図で、測定・実物写真ではない。文字はHTMLのキャプションに置き、スマホで図と一緒に極小化されることを避ける。
現行のprivate candidate入力はSVG配信を受け付けないため、preview生成時だけSVGからPNGを作る。元SVGを保持し、公開pipelineへSVG許可を追加したとは扱わない。
生成先は.local、承認なし、productionEligible=false。本番content/Media Registryを書き換えない。フォントはサイト側のファイルを内部描画に使うが、配布artifactへ含めない。

## ローカルの確認

1. npx tsx scripts/article-readability-preview.ts
2. node scripts/article-readability-capture.mjs

描画は既存buildPrivateCandidateAstroからContentLayout・MDX・Media Registry・route font処理を通す。ブラウザは環境変数ARTICLE_PREVIEW_BROWSERで指定可能。スクリーンショットは.localへ保存し、ブラウザとloopback serverは終了時に閉じる。
キャプチャでは図4点、目次の階層、理由ラベルの条件付き表示、実使用Webフォント、幅320/390/1440、文字サイズ200%、data-bt除外とアンカー解決を確認する。ブラウザのフルページ画像は遅延画像をeagerにしてから撮影するため、ネットワーク性能測定の証拠には使わない。
