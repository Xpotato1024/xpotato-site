# 素因数分解機0.1.1の固定採用

対象は既存 /tools/prime-factorizer/ の固定配布版と、PR113で統合した共通基盤です。ContentId・route・既存手動登録は保持し、生成管理への全面移行は行いません。旧0.1.0のvendor/pin/原本・補遺は保存します。記事hold、監視、資格情報・アクセス設定を変更しません。

## 固定する配布物

- toolkit source: 69d12a0a511e00a2e33040eb72f4222ce19a4f97（PR29通常merge）
- [GitHub Release 0.1.1](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.1.1)
- artifact SHA-256: 1d21b62421930792d5d4dafe501d97e809156330b43d52fb99ecfa588a64d383
- 72 files / 5,012,304 bytes。異なるclean checkoutの2buildが一致。
- PR29検証source07448231684e8c334eb95340b2baa214172ef245とmerge sourceはtree同一。GUI・整数入力・kernel・lifecycleの既存独立レビューと、同一artifactのprivate Chrome受入を再利用。
- source/lock/manifest/artifact/reviewのexact identityは releases.ts、config/browser-tools/prime-public-admission.json、prime-factorizer/v0-1-1-source-review.json に固定。

Releaseはruntime ZIP、完全repository source ZIP、provenance、checksumを提供します。Release assetのGitHub digestと準備したbytesは全件一致。AGPL、第三者条件、対応sourceの分離を保持。新musl原文はruntimeと公開 /tool-licenses/prime-factorizer-v0.1.1/MUSL-COPYRIGHT.txt に直接同梱し、最終distでも一致検査します。

## 公開admissionとCSP

共通bounded-browser-v2の一般公開を認可しません。admissionはexact prime pin・独立runtimeReview・2build hashへ束縛し、既存route/module/ContentIdだけを許可します。不明なtool/release、変更されたsource/review/artifact、fixture scope、未宣言capabilityは拒否します。

security-headers.ts・Wrangler・deploy workflowを変更せず、既存prime専用の script-src self + wasm-unsafe-eval + 生成hash、worker-src blob:、connect-src none、frame/object none を維持します。hashの再生成を権限拡大と扱いません。他ページへWorker/WASM許可を広げません。

## 検証と公開前条件

- 差分試験9件、型検査、site build成功。admission負例はschema正規化hashでfield照合を検証し、正常な再hash対照も保持。
- private受入原本: 同一artifactのonline/offline12ケース・ready後30観測区間、取消/timeout/Worker退役/複数instance/unmount/通常遷移/fresh recovery。desktop/mobile幅・keyboard/focus・長文・エラー再試行・axe4report違反0。
- コピー成功はtest clipboard実装で確認しOS clipboardを変更していません。非対応/拒否は手動選択へ。
- 初回ローカルci:finalは新checkoutに既存isolation prepare receiptがなく停止。guardを弱めず正規prepareを開始。authoring/review/visualは完了し、publication mockはWindows-backed WSLで6分超のため原本を保持して中断（ローカル全体finalはINCOMPLETE）。同じ実site distのtargeted Chrome受入は12ケース・30quiet区間・mobile axe違反0で成功。最終headの全体CIが正規prepare/finalを完了することをmerge前条件とする。
- 最終headのCI、独立レビュー、main pushのProduction artifact identityと受入はmerge/配信前に確認。PR artifactをProductionへ昇格せず、配信ではbuildし直しません。

実機iOS/Android・Firefox/WebKit・screen reader・実BFCache往復は未実施。viewport試験を実機試験とは扱いません。新しい5Worker全工程の性能改善率、OSのタブ終了防止、ASTの全dataflow証明を主張しません。サイト既存画像の日本語欠字は今回の修正対象ではありません。

採用PR初回CIは第三者license原文の末尾空白でscopeのdiff checkが停止。原文や配布hashを変更せず、旧版と同様に新版の当該4license pathだけ .gitattributes の書式例外へ追加した。runtime/API/asset/source/hash検査・CSP・workflowは緩和しない。
