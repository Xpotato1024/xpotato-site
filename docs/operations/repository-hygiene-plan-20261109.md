---
status: proposed
owner: development
last_verified: 2026-11-10
---

# リポジトリ整理の準備と保全条件

第一段階（2026-11-09）の基準はmain `e862538b8cae2249fba7c8fe98a043d7f96b67f5`。第一段階は文書訂正と次段階の設計だけで、pin・選択・公開admission・実行コードを変更しませんでした。第二段階はコピーを残して復元・検証を実装し、本人の指示で[PR170](https://github.com/Xpotato1024/xpotato-site/pull/170)を`d3b522303fa310d91b06cefa950b822a0f4c56e3`へmergeしました。以下は第三段階の候補と、第一・第二段階の当時の範囲を分けた記録です。

## 第三段階のコピー撤去候補（2026-11-10）

基準mainは`d3b522303fa310d91b06cefa950b822a0f4c56e3`。本人は、Prime旧版v0.2.2〜v0.2.4のコピー291ファイルだけを作業ブランチで削除し、検査・文書を更新してDraft PRを作る範囲を具体的に認可しました。現行v0.2.5、全10pin/review/source/license、固定Git履歴・タグ・公開licenseは保持します。今回の認可を追加削除・Ready化・merge・本番配信・provider/権限変更へ広げません。

- 撤去直前に[固定一覧](../migration/prime-history-retention-v1.json)の291pathと現物のexact-set・regular file・mode・bytes・blob OID・SHA-256を照合しました。全17,416,793 bytesと3treeは基準mainおよび固定復元元と一致し、Gitのpathspecでその291pathだけを撤去します。
- 一覧・history index・pin・選択・公開admission・runtimeは変更しません。通常検証は現物1版＋Git9版の全10pinです。復元元はmain祖先のままで、branch/tag削除や履歴rewriteを混ぜません。
- 保全回帰は現物の存在必須から、撤去前mainと復元元のtree一致、一覧全bytes、trackedコピー不存在、通常checkerへ切り替えます。独立full cloneで追加3版の同bytes restore/select/冪等性を維持し、各版の再展開後の改変・欠損を拒否して置換しないことも検査します。
- v0.2.2のprovenance試験は既存の固定Git fixture readerから同じartifactを実体化します。pin hashと改変拒否のassertionを減らしません。
- これはworking treeの重複削減で、Git履歴の容量削減・本番rollback受入れではありません。全体CI・Windows targeted試験・実dist比較の結果は第三段階のPRへ集約し、未実行をPASSとしません。

## 第二段階の実装候補（2026-11-10）

基準mainは`8a8520fb7ad315b15a9b8302416f6cb6544150d1`（#167・#168統合後）。以下の2026-11-09計画を履歴として残し、移行順序2〜5の実装・検証を追加します。

- 旧6版のhistory recordは不変。追加3版のtree・全path/mode/blob/size・pin fingerprintを再照合し、元のmain祖先`e862538b8cae2249fba7c8fe98a043d7f96b67f5`へ固定しました。291ファイルは削除せず保持します。
- [保全対象一覧](../migration/prime-history-retention-v1.json)は3版それぞれ97ファイル、計17,416,793 bytesの正確なpath・mode・blob OID・SHA-256を記録します。将来の削除認可や本番rollback受入れには使いません。
- 通常検証は全10pin。現物4＋Git6と、隔離した独立full clone内の現物1＋Git9を同じcheckerで検証します。追加3版の明示restore、全path同bytes、filesystem select、再実行時の無変更を回帰検査します。選択・admission変更は本checkoutへ持ち込みません。
- 展開済みの改変・不完全tree・通常ファイル・symlink/junction・lock競合は拒否します。未展開childの親がjunctionでもGit fallbackへ逃がさず、stage cleanupが失敗しても所有lockを解放します。途中write失敗の後片付けと再試行も検査します。
- 実Git fixtureでmissing commit、tree/pin不一致、unsafe path/mode、case重複、単一blob・総bytes・件数超過を拒否します。自動fetchやnetwork fallbackは追加しません。
- 選択v0.2.5、全pin/review/source/license、公開MUSL URL、workflow、配信設定は変更しません。既存のLinux source検証とWindowsで同じ回帰を実行します。通常CI・実dist比較の実行結果はPRへ集約し、未完了をPASSとしません。

移行順序6のtrackedコピー撤去は含めません。復元設計・検証のreview後も、別途具体的な認可と直前preimage照合が必要です。

検証対象は[PR170](https://github.com/Xpotato1024/xpotato-site/pull/170)の実装commit `73ca89089ca849204094f90d724687e3c6590f64`です。Node 24.22.1 / npm 11.19.0でWindowsの復元2suite・13件と、Hosted Linuxの全164suite・1306件が成功しました。[vNext CI](https://github.com/Xpotato1024/xpotato-site/actions/runs/42738214039)は全7jobが成功し、release試験534件、Linux build1回、公開browser検証、Windows artifact consumerも通過しました。[配信境界検査](https://github.com/Xpotato1024/xpotato-site/actions/runs/42738213946)も成功しています。実装差分の独立read-only確認にmaterialな指摘はありません。Windows全体CIは無関係な3suite・9件の5秒timeoutで失敗しました。該当3suiteの再検証は83件成功・6件skip・cache2件timeoutで、そのcache2件は基準mainでも同じ5秒制限で再現します。Windows全体PASSとは扱わず、timeoutやskipの条件も緩めません。

基準mainと実装commitをWindowsでそれぞれbuildし、distの503pathを比較しました。470ファイルは同bytesで、JS/CSS/font/image/固定runtime/license・公開MUSL URL・route集合・`_headers`は不変です。差分33件はHTML31件のsource commit/dateとPrimeの派生island UID、そのHTMLに連動するPWAのbytes/hash/version、`_publication.json`のsource/hash/総bytesだけです。既知のrevision差だけを正規化したHTML一致、PWAの実bytesとversion再計算、publicationの全local対象hashと総bytesを照合しています。これは実機受入れや本番rollbackの証拠ではありません。

## 現況と履歴を分ける

- 選択は[installations.json](../../config/browser-tools/installations.json)のPrime v0.2.5。全pinは[registry](../../apps/site/src/content-registry/interactive/releases.ts)と生成された選択版の合計10版です。
- [PR141](https://github.com/Xpotato1024/xpotato-site/pull/141)は2026-11-04に`2850960722b46217329db78957c67b3086bee188`でmainへ統合済み。これは基準mainの祖先です。
- [ADR-0066](../design/adr/0066-reproducible-repository-copy-retirement.md)・撤去対象表のv0.2.2／全7pin／489ファイルは当時の記録です。現在の選択や追加削除の対象へ読み替えません。日常の説明は[vendor README](../../vendor/README.md)と[所有表](repository-ownership.md)で訂正します。

## Prime v0.2.2〜v0.2.4を残す理由

未選択3版は現在の全pin検査に必要です。[history.json](../../config/browser-tools/history.json)に登録されているのはv0.1.0・v0.1.1・v0.1.2・v0.1.5・v0.2.0・v0.2.1だけで、追加3版を削ると実体検証へ進んで失敗します。現状の`restore`も追加3版を復元できません。

次表は基準mainのGit treeから実測した移行候補です。**削除指示でも、新しいhistory indexでもありません。** 共通の復元元候補commitは`e862538b8cae2249fba7c8fe98a043d7f96b67f5`。各pathは`vendor/browser-tools/prime-factorizer/<releaseId>`です。

| releaseId | regular files | bytes | tree OID |
|---|---:|---:|---|
| v0-2-2 | 97 | 5,804,241 | `d53e2e0a7544e6bbc23c68f61e2d4087c5bbbc85` |
| v0-2-3 | 97 | 5,805,991 | `c2c0a9a0f3e714c7790a9389140651b422cbe039` |
| v0-2-4 | 97 | 5,806,561 | `b9fd2f515711a1b98ad0f77d7a17d53cf6169957` |
| 合計 | 291 | 17,416,793 | 3個の固定tree |

将来の実装では、各既存pin全体のcanonical fingerprintを既存`fingerprint()`で導出し、commit・tree・pin SHA-256を追加します。手で短縮hashを写したり、mutable tag・PR-only commit・toolkit sourceだけを復元元にしません。Siteが採用したartifact bytesとsourceからの再buildは同一視できません。

### 移行の順序

1. 新しいmain基準で選択と全pinを再確認する。上記3tree、全path/mode/size/blob、既存pin/review/source/licenseを照合し、基準commitがmain祖先であることを確認する。差分があれば停止して計画を更新する。
2. **現物を残したまま**historyへ追加する実装を別PRで用意する。既存6版のrecordは不変とし、全10pin検査・選択版の実vendor必須・展開済み改変の拒否を保つ。件数固定の回帰fixtureは6→9への意図した移行として更新し、検査対象を減らさない。
3. full Git cloneの隔離fixtureで追加3版の現物だけを未展開にした状態を作る。既存[Git reader](../../packages/site-validators/src/browser-tools/browser-tool-history.ts)と[復元実装](../../tools/authoring/browser-tool-history.ts)を使い、固定tree→全pin検査→明示restore→全path同bytes→filesystem selectを順に検証する。選択変更はfixture内だけとし、本番admissionや公開設定を変更しない。
4. 復元先が改変済み・不完全・symlink・lock競合なら拒否し、既存bytesを置換しないことを確認する。missing commit、tree違い、pin fingerprint違い、unsafe path/mode、過大bytesにも停止する。ネットワークfallbackを追加しない。
5. Windows/Linux、既存旧版回帰、installer check、通常CIと実distを通す。v0.2.5のpin・配布bytes・公開license URLが不変であることを確認する。証拠と正確な291pathの撤去対象集合を固定する。
6. 復元設計と検証のreview後、**別途具体的に認可された変更**でだけtrackedコピーを撤去する。直前の選択・全preimage一致を再照合する。条件不足なら3版を残す。branch/tag削除や履歴rewriteを同じ作業へ混ぜない。

### 必要な検証と停止条件

| 検証対象 | 成立条件 |
|---|---|
| 全pin | 現物4＋Git6の現状と、移行候補の現物1＋Git9で同じ10pinを照合。選択版が欠ければ失敗 |
| 復元 | 3版それぞれ97pathのmode/size/SHAが固定Gitと一致。再実行は同bytesで変更なし。途中失敗・lock競合でも既存対象を壊さない |
| 改変拒否 | 展開済み不完全/改変treeをGitで救済しない。誤ったpin/tree/commit、link/危険pathは停止 |
| 旧回帰 | v0.1.0のfont/profile/license補足、v0.1.5の管理移管、v0.2.0のcomposed Worker/provenance拒否を維持 |
| 生成と公開境界 | installer plan/apply/check、登録manifest/生成wrapper/public admissionの一致、公開MUSL URLとsource offerを維持 |
| 通常検証 | fixed toolchainの`npm run ci`、必要なrelease/Windows consumer。新しい履歴依存を含むfull checkoutで実施 |
| 出力比較 | 同じ選択v0.2.5でbuildし、配布runtime・license・route・CSPを比較。Site source参照等の派生差分は理由と対象を明記 |

Git復元元は完全履歴内に残します。shallow cloneやplain archiveだけで復元できるとは説明しません。コピー撤去でworking treeは減っても、Git履歴の容量削減にはなりません。本番rollbackには復元だけでなく既存installer・review/admission・新しいProduction artifact・本人の配信認可が必要です。Gitの同bytes復元を本番rollback受入れに置き換えません。

## workflow 12本の用途と保持理由

run頻度や名前だけで未使用と判断しません。manual-only、path-filter、scheduleのgateによるskipは不要の証拠ではありません。次表は基準revisionのtriggerとコード上の役割であり、live監視の稼働・通知到達・本番受入れの証明ではありません。

| workflow | trigger | 役割・誤って削らない理由 |
|---|---|---|
| [ci.yml](../../.github/workflows/ci.yml) | PR / main push | 全体検証、1回のLinux build、Windows consumer、必須result。artifact作成は配信ではない |
| [production-path-review.yml](../../.github/workflows/production-path-review.yml) | PR / main push | offline-policyと合成transport試験。productionという名前でも配信しない |
| [phase6-media-readiness.yml](../../.github/workflows/phase6-media-readiness.yml) | 関連pathのPR / main push | 受入済みmedia処理証拠・held-card検査。R2保存とは別 |
| [legacy-reproduction.yml](../../.github/workflows/legacy-reproduction.yml) | 関連pathのPR / manual | 固定legacy buildの再現。旧コード撤去後も復元契約を検査 |
| [legacy-visual-performance-baseline.yml](../../.github/workflows/legacy-visual-performance-baseline.yml) | 関連pathのPR / manual | 旧表示・性能baselineの比較証拠。通常buildとは対象が異なる |
| [deploy-site.yml](../../.github/workflows/deploy-site.yml) | manualのみ | owner/main/Environment/Production artifact guard付き配信。PR・pushでは起動しない |
| [publish-article-media.yml](../../.github/workflows/publish-article-media.yml) | manualのみ | 承認済みpackageのABC保存・照合。記事編集やCI buildだけで起動しない |
| [environment-approval-check.yml](../../.github/workflows/environment-approval-check.yml) | manualのみ | Environment承認の疎通。checkout・secret・provider操作・配信なし |
| [site-readback-only.yml](../../.github/workflows/site-readback-only.yml) | manualのみ | 既配信artifactのGET検証。再配備せず過去failureも書き換えない |
| [site-integrity-monitor.yml](../../.github/workflows/site-integrity-monitor.yml) | manual / schedule | bootstrapとruntime gate付き観測。skipや停止を未使用と扱わない |
| [site-monitor-readiness.yml](../../.github/workflows/site-monitor-readiness.yml) | manualのみ | 有界なread-only事前診断・合成通知試験。監視activationと区別 |
| [site-monitor-trial-evidence.yml](../../.github/workflows/site-monitor-trial-evidence.yml) | manualのみ | 本人承認付き有限trialの非secret証拠収集。通常監視とは保持責務が異なる |

配信とmedia保存のworkflowにPR/push triggerがなく、PR/main pushのworkflowは検証用であることを確認しました。[現行配信境界](current-deployment-status.md)もmanual-onlyを要求します。旧Workers Builds連携の解除記録は[設計状態](../architecture/design-status.md)にあり、基準mainのcheck一覧に現れたprovider配信runも[42592439951](https://github.com/Xpotato1024/xpotato-site/actions/runs/42592439951)の`workflow_dispatch`でした。この文書PRではworkflowを変更・dispatchしません。

`environment-approval-check.yml`は[承認試験](../../scripts/release/deployment/environment-approval.test.mjs)と[adapter試験](../../scripts/release/deployment/deployment-adapters.test.mjs)が直接読みます。少数の手動runだけを見て単体削除すると検証を壊します。旧monitorのscheduleがskipされていても、live coverageが成立したとも、コードが不要とも判断しません。過去run・artifactや現行mainから消えたworkflow名も証拠の参照先になり得るため、Actions画面の整理を理由に履歴を削除しません。

旧監視workflowの将来撤去は、新しい観測・本人通知の受入れと依存関係の確認後に別途扱います。先に名前やskip数だけで消すと復旧診断、offline safety、証拠収集を失うため、今回は12本を保持します。

## branchと履歴

このPRではbranch/tag/Git objectを削除しません。main祖先、内容一致、未統合は別の判定です。内容一致だけではmerge済みと断定せず、未統合差分・open PR・復元ref・利用中worktree・再開用branchの依存を確認します。将来の整理には正確なbranch名/head SHA/判定根拠の一覧と別の削除認可が必要です。
