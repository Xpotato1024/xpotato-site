# 読者範囲と図の文字階層を確認する記事

公開記事ではない。本文は`article.mdx`、読者と例示条件は`editor-context.md`。

- メーカー共通の観察・判断を先に置き、製品別の設定名を後半で示す。
- 3つの比較を、幅320pxのSVG8パネルで表現する。`Gallery layout="diagrams"`でPCは複数列、モバイルは1列へ再配置する。
- 図中文字18pxは320px幅での制作値。掲載後は14〜18px、本文16pxとの比率を検査する。元SVGも保持する。
- `ARTICLE_PREVIEW_HERO`にローカルの完成ヒーロー画像を指定し、`npx tsx scripts/article-concrete-preview.ts`→`node scripts/article-concrete-export.mjs`で正規のprivate candidateから出力する。
- 表紙なしで本文・図版を点検する場合は両コマンドに`--composition-only`を付ける。PDF・スクリーンショットでは仮の表紙を隠し、`review-body-*`として出力する。これは完成ヒーローの描画検証ではない。
- exportは毎回新しい私有`export-*`フォルダへ作り、旧フォルダの画像を混入させない。出力先はコマンド結果で確認する。`--html-only`ではPDFを作らず、HTML・画像・画面検証だけを出力する。
- ContentLayout、MDX、階層型目次、Media Registry、route fontの既存経路を使用する。導入は先頭の通常段落を最大2段落までhero/目次の前へ出す。
- 設定値は比較例。実際の造形・強度・所要時間を測定したとは扱わない。
- 一式には原稿・小図・出典・スキル・検証記録を含め、フォントファイルを含めない。
- `synthetic_fixture` / `reference` / `productionEligible=false`。本人の公開承認、マージ、デプロイは別。
