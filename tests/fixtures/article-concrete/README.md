# 具体例と図の説明力の検証記事

公開記事ではない。Skill改訂 a5dce85572f7f88c932e79c4e7aec85f3a0d5f05 を読み、別の内容改稿として作成。

- 本文：article.mdx。読者・条件：editor-context.md。
- 本文図：walls.svg / orientation.svg / roof.svg。日本語ラベル付き。
- 描画：npx tsx scripts/article-concrete-preview.ts
- 出力：node scripts/article-concrete-export.mjs
- ContentLayout、MDX、目次、Media Registry、route fontの既存経路を使用。
- ヒーローは手動制作の生成画像＋原本アイコンの合成。fixture rendererの内部画像枠は完成画像ではなく、最終成果物で必ず置換する。生成画像をGitに追加しない。
- 数値は設定を比較する例。強度・印刷時間を測定したとは扱わない。
- 設定名・アイコンは本文末の固定upstream revisionへ結び付ける。
- 配布用exportはPDF・HTML・図・原稿・Skillだけ。フォントファイルを含めない。
- synthetic_fixture / reference / productionEligible=false。公開承認・マージ・デプロイなし。

## 完成画像の入力

`ARTICLE_PREVIEW_HERO`に16:9の完成画像のローカルパスを指定してpreviewを実行する。生成画像はGitへ追加しない。実際に使用した画像のhashをcandidate identityへ結び付け、HTMLのMedia Registryから描画する。PDF印刷後の画像差し替えは行わない。

画像なしで配置のみ確認する場合はpreview/exportの両方へ`--composition-only`を明示する。その出力は完成プレビューではない。exportは画像未準備・hash不一致を検出して停止する。
