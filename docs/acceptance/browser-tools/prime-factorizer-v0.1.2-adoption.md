# 素因数分解機0.1.2の固定採用

既存 `/tools/prime-factorizer/` の配布版だけを更新します。ContentId `bca48f98-c89a-457f-84d8-168f941fe469`、本文・metadata・公開状態・visible hydration・手動登録方式を維持します。PR115の画像、PR116の登録移行、PR117の表示変更、toolkit PR31は含めません。旧0.1.0/0.1.1のvendor・pin・review・公開license原文は保持します。

## 配布物と再利用する証拠

- 正式[Release v0.1.2](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.1.2)、source `9d16f826a3aba90794e150a5c34236b29419e49f`。PR32の独立レビュー対象20370a29と同じGit treeです。
- runtime ZIP SHA-256 `40f86abd69a6f37d4ac5eb50ebcc2a35b5916c93189aa430d3811e53ebef178d`。公開ZIP・provenance・checksumを認証なしで再取得し、GitHub digestと照合しました。
- artifact SHA-256 `0c7e4f868c17d9e7d16628115b73fd67e744de4e9757ba66a00f5390ce25dfde`、72 files / 5,013,097 bytes。正規validatorでsource全2470ファイルとGit blob、lock、manifest、file exact-set/hash、licenseと配布物を照合しました。
- Release準備時の2clean checkoutビルドと、同treeの実merge SHAからの追加buildを再利用します。今回の公開ZIPを当該2buildのartifactと改めて照合しました。独立reviewerはローカルZIP/buildの再実行をせず、producerの実測証拠に依拠しています。
- 0.1.1との差分はSOURCE_OFFER、package、adapter版表示、manifestの4ファイルだけです。68ファイルはbytes同一で、kernel・Worker/WASM・CSS・runtime条件・依存は不変。PR29のruntime reviewと0.1.1の受入証拠を、この不変範囲に限り再利用します。
- toolkitの実distでFirefox151.0 / WebKit26.5が各12ケース成功した記録を再利用します。単独adapterの記録であり、SiteのReact hydration/unmountや本番受入の代替とは扱いません。

toolkit公開前のmain CIは全9成功。タグCI初回では実験用siqs-labの `all collected relations pass native polynomial verification` が `Native validation` assertionで失敗（10/11成功）。同じSHA・assertion・時間制限で当該jobだけを1回再実行し、[attempt 2](https://github.com/Xpotato1024/browser-prime-toolkit/actions/runs/39892211444/attempts/2) は11/11成功、タグ全9 workflow成功です。初回原因は未確定で、環境起因や数値不具合修正と断定しません。siqs-labは配布manifestに含まれません。

## Site接続と配信の条件

正規adopt CLIの検査を通して新releaseId `v0-1-2` へ追加し、source review・pin・file dependency/lock・明示manifest/CSS import・公開admissionを同じ候補に固定します。新規tool向けinstallerによる手動登録移行は行いません。musl原文は配布物と同じbytesを `/tool-licenses/prime-factorizer-v0.1.2/MUSL-COPYRIGHT.txt` へ同梱し、readinessと実distで検査します。旧版と同じ4つの第三者原文pathにだけ書式例外を追加し、全file hash検査は維持します。

URL・ContentId・SEO、入力・サンプル・コピー・取消/再実行、Worker/Blob退役、既存表示を影響範囲に応じて検証し、結果は採用PRへ記録します。source offerは実際のSite build SHAを示します。security-header policy、Wrangler config、deploy workflow、監視、資格情報・権限は変更しません。公開admissionはこのexact pinと既存prime routeだけであり、一般のCSP拡大を認可しません。

最終headのCIと独立review、通常merge、成功したmain pushのProduction artifact取得・identity照合が配信前条件です。PR candidateをProductionへ昇格せず、配信時に再buildしません。既存の本人対応可能確認・Environment承認・fresh preflight・preimage・単発deploy・provider/public readbackを維持します。未実施の配信を完了とは記録しません。

実iOS/Android、Safari本体、screen reader、実BFCache往復、WebKitの物理的切断状態、長時間/多Worker性能は未検証です。390px viewportは実機iPhoneではありません。Site同期の完了は、記事hold解除・media realization・cutoverやSite全体の完成を意味しません。
