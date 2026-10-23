# 素因数分解プラグイン結合版の対応ソース

本サイトの /tools/prime-factorizer/ に配信するブラウザプログラムは、AGPL-3.0-onlyのbrowser-prime-toolkit固定版と、siteのReact island結合コードから構成されます。ページ上の「サイト組み込みソース」は実際にbuildしたGit checkoutの40桁commitへ固定し、この文書・全source archiveも同じcommitで提供します。tag/mainを追跡して実行時に更新する仕組みではありません。

## 許諾と対象

Xpotato1024が権利を有する、当該結合プログラムのsite integration codeと、その生成・インストール・実行・改変に必要なbuild/control sourceをAGPL-3.0-onlyの条件で提供します。具体的にはprime-factorizerのisland wrapper、固定版表示、registryとsource案内、およびそれらを結合するAstro/Vite設定・依存lock・build/release scriptの該当部分です。AGPL本文は同じcommitの vendor/browser-tools/prime-factorizer/v0-1-2/LICENSE にあります。

toolkit・native upstream・Emscripten/GMP等の第三者コードは各ファイルの著作権表示とLICENSE/NOTICE/THIRD_PARTY_NOTICESに従います。React/ReactDOMとAstro/Vite等のbuild依存もそれぞれのlicenseを保持し、package-lock.jsonの固定version・配布integrityと各packageのlicense/sourceを参照してください。元の条件を削除・再許諾するものではありません。

独立した記事本文、写真、ロゴ、他ツール等を、この案内で一括してAGPLへ変更しません。全repository source archiveには再現buildに必要なsite入力も含まれますが、作品ごとの権利・第三者条件は区別してください。

## 同じ配布物を再生成する入口

1. ページが示すexact site commitの全archive、またはそのcommitのcheckoutを取得する。
2. .node-version（24.22.1）と packageManager（npm11.19.0）、package-lock.jsonを固定する。
3. npm ci --ignore-scripts でlockどおりの依存を取得する。vendorのfile dependencyとmanifest/hashを検証し、latest/CDNから分解機コードを取得しない。
4. npm run ci を実行する。通常buildは公開providerやremote mediaを必要としない。Chromeによる受入れにはREADMEとrelease-interactionの環境条件に従う。
5. npm run build の出力は apps/site/dist。公開配信物のidentityはProduction artifactのsource SHA・run/attempt・artifact digestと照合する。

元toolkitのsource commit・全配布hash・2回のclean buildは apps/site/src/content-registry/interactive/releases.ts と docs/acceptance/browser-tools/prime-factorizer/v0-1-2-source-review.json に固定されています。toolkitを改変・再buildする場合は同じvendor内 SOURCE_OFFER.md、licensing/site-release-candidate.json（今回adapter）、licensing/site-release-v0.1.0.json（変更のないkernelの履歴mapping）、toolkitの完全なsource archiveとbuild recipeを使用してください。siteだけのsourceでnative upstreamを推測して置き換えません。

改変版をネットワーク越しに提供する場合も、AGPL第13条を含む適用条件に従い、その版の対応ソースを利用者へ提供してください。このsource案内の確認は、未実施の本番配信や実機試験を証明しません。

## v0.1.0のライセンス補遺

元の固定runtime ZIPは69ファイルのまま保持します。同梱Emscripten NOTICEのMUSL-COPYRIGHT.txt参照について、本文の配布漏れを同じsource d1c0e57の原文（6204 bytes、SHA-256 f9bc4423732350eb0b3f7ed7e91d530298476f8fec0c6c427a1c04ade22655af）で補います。同じGitHub ReleaseのMUSL-COPYRIGHT.txtとLICENSE-SUPPLEMENT.mdを利用・再配布時に保持してください。

siteは vendor/browser-tool-license-supplements/prime-factorizer-v0-1-0/ に同じ原文とsource/tree/hash metadataを含め、通常pin検証でも確認します。元ZIPやimmutable artifact manifestを上書きせず、siteの対応source archiveにも補遺を含めます。CIのMarkdown相対リンク検査は元NOTICEの当該1参照だけこの検証済み補遺へ解決し、他の不明・欠損リンクは拒否を維持します。

元ZIPだけを完全なnotice同梱版とは扱いません。同Releaseの browser-prime-toolkit-v0.1.0-complete.zip は元ZIPのbytesをそのまま内包し、MUSL原文・補遺・展開手順も一緒に含む完全配布セットです。利用・再配布には完全セットを使用してください。

本サイトのProduction artifactにも apps/site/public/tool-licenses/prime-factorizer-v0.1.0/MUSL-COPYRIGHT.txt から原文を同梱し、公開URL /tool-licenses/prime-factorizer-v0.1.0/MUSL-COPYRIGHT.txt でページから読めます。固定source補遺と公開fileが完全一致することをpin検証で確認します。

## v0.1.1の固定採用

PR29を統合したtoolkit source 69d12a0a511e00a2e33040eb72f4222ce19a4f97を採用します。旧0.1.0は履歴と補遺を保持します。0.1.1にはmusl原文を配布物へ直接同梱し、公開原文も /tool-licenses/prime-factorizer-v0.1.1/MUSL-COPYRIGHT.txt へ固定します。共通bounded-browser-v2の公開admissionはこの固定版・既存prime routeだけで、他のツールやページへCSPを拡大しません。

## v0.1.2の固定採用

現在の選択版はtoolkit source 9d16f826a3aba90794e150a5c34236b29419e49f、正式Release v0.1.2です。旧版のvendor・pin・review・補遺を保持し、新版の対応sourceは同じ固定commitとReleaseのsource ZIP・provenanceへ束縛します。musl原文の公開pathは /tool-licenses/prime-factorizer-v0.1.2/MUSL-COPYRIGHT.txt です。計算・Worker/WASM・CSSのbytesとruntime条件は0.1.1から不変で、CSPや権限を拡大しません。取り込みと検証範囲は docs/acceptance/browser-tools/prime-factorizer-v0.1.2-adoption.md を参照してください。
