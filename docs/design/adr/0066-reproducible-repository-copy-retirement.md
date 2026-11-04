---
status: proposed
owner: development
last_verified: 2026-11-03
---

# 0066: 再現可能なコピーの撤去を公開移行の受入れから分離する

本人が要求した全体整理のためのPR141内の契約改訂。最初の実削除は自動審査で実行前拒否となったが、撤去対象表の613 trackedファイルに対する本人の具体的承認後、全preimage・固定Git復元元を再照合して作業ブランチから撤去した。124 text/configと旧6版489ファイルだけが対象で、Git履歴は変更しない。Draftでありmainへの採用・本番反映・公開移行の完了とは扱わない。

613コピー撤去時点の全path・bytes/SHA-256・履歴tree・保持9rasterは[撤去対象表](../../migration/reproducible-copy-retirement-plan-v1.json)。その後の本人の旧構造完全撤去指示に従う9画像の現配置は[新サイト入力catalog](../../../apps/site/source-inputs/media/catalog.json)。撤去表は当時の記録として改変せず、実行権限やcutover証跡にも使わない。

## 旧root

旧rootは現行buildの入力ではない。注釈付きlegacy tagの実objectとpeeled commit `927d105713561309fc5e2374396f86646b5aeb2a`、凍結baselineとのblob一致を検証し、src113・旧Astro/Tailwind/Wrangler設定3件・publicのSVG7件とrobotsの**正確な124 regular UTF-8 blobs**だけを再現可能なコピーとして撤去対象にする。拡張子やprefixだけの一般許可ではない。Git replacementを無効にし、既存のbounded batch readerでobject type/size/hashを検証する。

実Gitから導出した集合だけ削除・rename元を許可し、未知pathは従来gateで停止する。固定tagの別worktreeによる旧build再現、124件の同bytes復元、現行出力比較、通常CIが成立条件。履歴改変・tag削除・自動fetchは行わない。

**9 rasterの原bytesは破棄せず、root publicは撤去する**。新サイトの配信対象外`apps/site/source-inputs/media`へ同bytesを移管し、catalogがcontent-addressed pathと既存ContentId/asset/rights記録を対応付ける。ホーム1件と移行6件の現物readerも新配置へ接続し、置換済み1件・未割当1件は再採用せず保全する。公開Gitなので秘密保管領域ではなく、新規rasterの一般入口でもない。

root removal gateとGit raster gateへ渡す移管集合は、固定tagの正確な9 blob、catalogのexact set/所有、現物SHA/size/regular file、旧コピー不存在を実測して導出する。拡張子やdirectoryの包括許可は作らず、欠損・改変・重複・unknown path・symlinkは拒否する。新配置を候補build fingerprintへ含め、原bytesのdist流入も通常static gateで拒否する。

[media recovery契約](../../contracts/media-recovery-contract.md)のpublic/protection/compact binding/代表復元SHA条件は、将来の原bytes廃棄に対して維持する。同bytesを新所有領域へ保持する移管は、媒体の廃棄でもR2移行完了でもない。旧44記事のhold・ID/URL履歴・移行manifest・未成立provider redirect/cutover/本番rollbackも維持。Git復元やrepo内の移管を実media復旧・公開移行のPASSにしない。

## vendor

working treeは選択中v0.2.2だけを必要とする。旧6版は既にmain祖先である`97d69d2858bf26346cd57815d7f7697ae81af1aa`のtreeに固定する。PR-only commitをauthorityにせず、将来squash/branch削除でもmainの完全履歴に残るrevisionを使う。config/browser-tools/history.jsonはtree OIDと全pin SHA-256を束縛する。pin/review/source/licenseとpublic MUSL URLを削除しない。

**全7pinの通常検証は維持**。選択中の版は実vendorを要求。既知の履歴版が未展開の場合だけ固定Git treeを同一artifact checkerへ渡す。mode/path/case/size/object hash、manifest exact-set/SHA-256、runtime/rights/provenanceを全て検査しnetwork/cacheへ逃がさない。展開済みtreeの改変・不完全状態は拒否し、Git fallbackで隠さない。missing objectはfull Git checkoutを要求して停止。

verifyToolPin/selectToolReleaseは従来どおりfilesystemを検査。差戻し前に`npm run browser-tools -- restore --tool prime-factorizer --release <旧releaseId>`を明示実行する。復元は既存adoption lock、fresh stage、同じchecker、atomic renameを使い異bytesを置換しない。復元は選択・掲載・公開を行わず、selectでも実bytesを再照合する。

旧版回帰は同じ正本をprivate fixtureへ実復元し、成功・改変拒否・provenance・font fallbackのassertionを維持する。旧版を1版へ丸めず、検査をactive-onlyへ減らさない。

## 再現環境と境界

通常build/runtimeのremote媒体・provider依存を増やさない。CIはfetch-depth:0を維持。exact site commit・legacy tag・上記main祖先を含む完全Git履歴が再現入力。plain archive単独ではCIの履歴検証を再現できないのでSITE_SOURCE_OFFERを同期する。archive/source URLは閲覧用に維持する。

provider操作・公開hold解除・実画像削除・merge/deployの認可は増えない。削除前にsource/試験/独立reviewを固定し、不足・拒否ならコピーを残して停止する。
