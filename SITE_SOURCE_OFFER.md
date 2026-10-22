# 素因数分解プラグイン結合版の対応ソース

本サイトの /tools/prime-factorizer/ に配信するブラウザプログラムは、AGPL-3.0-onlyのbrowser-prime-toolkit固定版と、siteのReact island結合コードから構成されます。ページ上の「サイト組み込みソース」は実際にbuildしたGit checkoutの40桁commitへ固定し、この文書・全source archiveも同じcommitで提供します。tag/mainを追跡して実行時に更新する仕組みではありません。

## 許諾と対象

Xpotato1024が権利を有する、当該結合プログラムのsite integration codeと、その生成・インストール・実行・改変に必要なbuild/control sourceをAGPL-3.0-onlyの条件で提供します。具体的にはprime-factorizerのisland wrapper、固定版表示、registryとsource案内、およびそれらを結合するAstro/Vite設定・依存lock・build/release scriptの該当部分です。AGPL本文は同じcommitの vendor/browser-tools/prime-factorizer/v0-1-0/LICENSE にあります。

toolkit・native upstream・Emscripten/GMP等の第三者コードは各ファイルの著作権表示とLICENSE/NOTICE/THIRD_PARTY_NOTICESに従います。React/ReactDOMとAstro/Vite等のbuild依存もそれぞれのlicenseを保持し、package-lock.jsonの固定version・配布integrityと各packageのlicense/sourceを参照してください。元の条件を削除・再許諾するものではありません。

独立した記事本文、写真、ロゴ、他ツール等を、この案内で一括してAGPLへ変更しません。全repository source archiveには再現buildに必要なsite入力も含まれますが、作品ごとの権利・第三者条件は区別してください。

## 同じ配布物を再生成する入口

1. ページが示すexact site commitの全archive、またはそのcommitのcheckoutを取得する。
2. .node-version（24.22.1）と packageManager（npm11.19.0）、package-lock.jsonを固定する。
3. npm ci --ignore-scripts でlockどおりの依存を取得する。vendorのfile dependencyとmanifest/hashを検証し、latest/CDNから分解機コードを取得しない。
4. npm run ci を実行する。通常buildは公開providerやremote mediaを必要としない。Chromeによる受入れにはREADMEとrelease-interactionの環境条件に従う。
5. npm run build の出力は apps/site/dist。公開配信物のidentityはProduction artifactのsource SHA・run/attempt・artifact digestと照合する。

元toolkitのsource commit・全配布hash・2回のclean buildは apps/site/src/content-registry/interactive/releases.ts と docs/acceptance/browser-tools/prime-factorizer-v0.1.0-source-review.json に固定されています。toolkitを改変・再buildする場合は同じvendor内 SOURCE_OFFER.md、licensing/site-release-v0.1.0.json、toolkitの完全なsource archiveとbuild recipeを使用してください。siteだけのsourceでnative upstreamを推測して置き換えません。

改変版をネットワーク越しに提供する場合も、AGPL第13条を含む適用条件に従い、その版の対応ソースを利用者へ提供してください。このsource案内の確認は、未実施の本番配信や実機試験を証明しません。
