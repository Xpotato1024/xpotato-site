# 性能検証の案内

現在のAの採用・画面幅に応じた検索とメニューは、[ADR 0041](../design/adr/0041-primary-cta-and-responsive-search.md)と[ビジュアルデザイン仕様書](../design/visual-design-reference.md)から確認できます。以下のJSONはそれぞれの検証時点の記録であり、後続の実装で測り直した数値に見せかけません。

今回の最終検証は[cta-header-v1.json](cta-header-v1.json)です。20条件のEdge・WebKit表示、320pxのコントラスト修正、操作状態、モバイル条件でのホーム・検索の3回計測、実装のハッシュを記録しています。正確なコミットとCI結果はDraft PR 65に記載します。

受け入れ条件とツール比較は[ADR 0038](../design/adr/0038-measured-static-delivery.md)に記録しています。素材容量の上限は`budget-v1.json`に明記し、公開用ビルドを1回行った後に`npm run performance:check`で確認します。静的ページ・検索・コードコピー・ツールを区別し、ツールは既存のReact islandを維持します。

その後の透明ガラスのレビュー候補は、[ADR 0039](../design/adr/0039-transparent-glass-after-phone-review.md)と`glass-review-v1.json`に記録しています。WebKit・Edgeのスクリーンショット、模様付き背景での実際のSVG対応実験、暗い写真上の文字コントラストのサンプル、同条件でのホーム性能の悪化確認を含みます。透明感と反射のあるCSSによる近似であり、Safariで本当の空間的屈折を行うものではありません。ユーザーは2026-10-06にiPhone実機でのフィードバック後、ガラスの質感を採用しました。その後の周囲との配置調整候補と、保持している変更前後の証拠はADR 0040とhero-harmony-v1.jsonにあります。

## 再現手順

リポジトリーで固定しているNode・npmを使います。`npm ci`の後、公開用ワークフローに記載された一時ディレクトリー・ブラウザー環境を設定し、`npm run ci`を実行します。既存のビルドを再ビルドせずに確認する場合は、以下を実行します。

```sh
npm run performance:check
```

ローカルのモバイル性能計測では、`CHROME_PATH`をローカルのChromium・Edge実行ファイル、`XPOTATO_RELEASE_TEMP`を書き込み可能な一時ディレクトリーの絶対パスに設定し、以下を実行します。

```sh
node scripts/performance-smoke.mjs apps/site/dist /absolute/temp/result.json
```

スクリプトは指定したローカル成果物だけをループバックで配信し、一時ブラウザープロファイル、キャッシュ無効、390×844/DPR1、CPU 4×、遅延150 ms、ダウンロード200,000 B/sの条件で、各経路を3回計測します。HTML・CSS・JS・JSON・SVGにはローカルgzipを使います。画像とWOFF2は圧縮済みです。結果にはブラウザー版、素材の分類、LCP・CLS、限界を記録します。合成のコード詳細ページは非公開レビュー用ビルドだけに存在し、公開記事にはしません。

`review-performance-v1.json`には変更前後の観測値と中央値があります。基準はコミット`d1c6f8770c8f08e3c5dc9614d111a7a315f63d83`、変更後の成果物にはこのPRの性能改善実装を使っています。ホームの写真計測は非公開レビュー専用と明記しています。素材のバイト数は符号化されたレスポンス本文の容量で、HTTPヘッダー分を含みません。証拠内の経路は公開対象となる経路か、合成であると明示した非公開詳細ページです。保留記事の本文や環境の認証情報はありません。

## 任意のオフラインフォント再生成

固定のコードポイント集合は、レビュー済みの最適化用スナップショットであり、公開記事の一覧ではありません。新しい内容でも元の補完用分割ファイルを使えます。公開可能な文字が増えた場合、集合の更新は任意です。検索画面の文言と公開可能な抜粋を含みます。保留記事の内容から新しい集合を作らないでください。

Windows x64のCPython 3.12を、独立した一時環境で使います。

```sh
python -m pip install --require-hashes -r scripts/font-core-requirements.txt --target /absolute/temp/fonttools
# Set PYTHONPATH to that isolated directory.
python scripts/generate-font-core.py
```

上のコメントは「PYTHONPATHをその独立したディレクトリーに設定する」という意味です。既定のコマンドは一時ディレクトリーでバイト単位の再現を検証します。`--write`は、入力のレビュー後に生成バイナリー4つ、CSS、マニフェストを意図的に更新します。フォントのライセンスはSIL OFLで、元のライセンスを維持します。Pythonのツールはビルド・CI・ブラウザーに不要です。

## 非公開の写真配信試行

```sh
node scripts/optimize-review-photo.mjs /private/source.jpg /absolute/temp/variants
```

出力先はOSの一時領域、またはRUNNER_TEMP内でなければなりません。報告には原本と派生画像のハッシュ、寸法、容量、Sharp・ネイティブライブラリーの版を含めます。`SITE_PREVIEW_WORKSHOP=1`は、ローカルの派生画像を渡した独立した非公開レビュー用ビルドだけに使います。公開用ビルドでは絶対に有効にしないでください。原本写真や試行で生成した画像はコミットしません。レビュー画像を更新する前に、形式の代替選択と構図をブラウザーで確認します。

本番の画像処理、ストレージ、公開の承認条件は変更しません。今後承認される画像には既存のhero・bodyプロファイルを使い、寸法を明示します。即時・高優先度読み込みは実際のヒーローだけ、本文画像は遅延読み込みにします。容量上限の検証では、出力された読み込み・寸法の契約を確認します。出力外で保留中の素材を計測したと見せかけません。
