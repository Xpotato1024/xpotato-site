---
status: proposed
date: 2026-09-25
owner: architecture
---

# ADR-0033: Build onceと目的別ゲートによる配布設計

## 状態と権限

PROPOSED。設計依頼に基づくreview用の提案であり、既存のAccepted contractをまだ置換しない。
採用はdesign-statusの明示更新による。設計採用、実装merge、production authorizationを区別する。
本PRはcredential発行、provider操作、deploy workflow解除、publication hold解除、移行を許可しない。
採用後に置換するのはADR-0032のproduction artifact決定性・UID書換え・独自tree hashと、下記の通常検証の適用範囲である。
ADR-0030/0031のfrozen legacy比較、Article Jobのhuman approval・disclosure・media recovery、Serverのcredential/endpoint/containment契約は変更しない。

## 目的と確認した事実

上位目的は[Product Context](../../product/product-context.md)の低運用コストでの安全な記事追加・更新である。
成功基準は「チェックを通す」ではなく、必要な検証を終えた成果物を差し替えずに配布できること。
調査基準はSite main 31671fc376c8fd9a874b726c8db8ac77cd3c9caa、handoffのServer authority c54a06ee377cae365af623b598ed852c4b577e1f。

LLM-01上のsourceおよびreadiness reportを確認した。
- package.jsonのbuildはstatic検証とmanifest生成を含むが、validate/phase7/phase8がstatic検証を再実行する。
- ci.ymlはbuild後にmanifestを再生成し、配布物本体を保存しない。mainのrun 36018851457のartifact 10815917268もmanifestのみだった。
- vNext canonicalizerは特定のTool HTML、asset名・内容、framework source/versionを固定し、合法的なUI変更にもprofile更新を要求する。
- 2026-09-24のreadinessは承認対象と_headersの改行が違ったため停止した。これは当時のexact-artifact契約では正しい停止であり、事後にPASSへ読み替えない。
- 専用temp rootの削除拒否は報告されているが、全内容の無害性を本設計で追認しない。

SHA計算自体の所要時間は計測していない。削減対象は重複I/Oだけでなく、再build・差分調査・再承認・環境修復の連鎖である。

## 選択: 検証した同じ成果物を配布する

    reviewed exact source + lock/toolchain
      -> Hosted Linux build (1回)
      -> search生成 + final headers生成
      -> final security/route/search/interaction検証 (各責務1回)
      -> 配布物本体 + exact config + release recordをpackage化
      -> immutable artifact ID / digestへ固定
      -> 対象artifactのreview + operation authorization
      -> 取得・整合性確認 -> fresh provider precheck
      -> 同じpackageからWrangler -> postcheck -> token revoke

build ownerは既存のGitHub Actions。workstation JITは同じartifactを取得するtransport/executorであり、siteを再buildしない。
正式deploy workflowの解除やpersistent credential導入は本変更の前提にしない。既存JIT/containment契約を維持する。
Windowsは開発・preview・deploy実行環境として利用できるが、Hosted Linuxとのbyte一致を通常配布の条件にしない。
Windowsでproduction buildしないことを、Windows関連testの失敗をPASS扱いする理由にしない。

### Releaseの最小構成

標準GitHub Actions artifactに、次の相対配置を保存する。
- apps/site/dist/ : 検証後の全Static Assets。必要なdotfile/control fileも含める。
- apps/site/wrangler.jsonc : sourceと同一の唯一のdeploy config。assets.directory=./distを維持する。
- release.json : source repository/SHA、Server handoff SHA、workflow/run ID/run attempt、toolchain version、validation結果への参照。

release.jsonは出所の記録であり、自分自身またはpackageのdigestを自己参照しない。
source、node_modules、private media、credential、ログ、任意実行scriptはpackageへ入れない。
既存configにないenv/CLI override、build hook、異なるassets root、非承認.assetsignoreによる除外を許可しない。
通常のsource内容チェックとpackage内容チェックは異なる責務だが、同じsecurity検証を複数CLIで再実装しない。

### Identityと検証の場所

原則、GitHub artifact IDとAPIのSHA-256 digestを使用し、独自の全file SHA manifest/tree algorithmを通常経路から撤去する。
取得側は認証済みGitHub APIでrepository、source SHA、trusted workflow、run/attempt、成功結果、artifact ID、未失効を照合する。
名前が同じ、latest、同一branch、同一source SHAというだけで別runのartifactを選ばない。fork/PR用artifactをproductionへ昇格しない。
raw download archiveのdigestをAPI値と照合し、不一致を必ずnonzeroにする。GitHub download actionのwarningだけに依存しない。
expected digestを取得file自体から自己申告させない。digestは完全性の証拠であり、producerの信頼を単独では証明しない。

検証済みarchiveをfreshなoperation-owned stagingへ安全に展開し、path traversal、absolute/drive path、symlink/reparse escape、異常な展開サイズを拒否する。
このstagingでは再build、header/UID正規化、任意hook、別writerによる編集を禁止し、pinned Wranglerがexact configを使う。
検証後のstaging保全を保証できない実装は、最終handoffで1回の整合性確認を追加するか停止する。無保護の展開先を安全と仮定しない。
packageの新規作成ごとに新artifact identityとなる。同じsourceの再buildでも新しいcandidateであり、過去の承認を流用しない。
一度選択したimmutable artifactに対する転送再試行は、認可期間と条件内で同じID/digestに限る。production mutationを自動再試行しない。

### 保存とrollback

artifactには有限のretentionがある。active releaseと必要なrollback releaseを、期限前に既存GitHub Release assets等の承認された保管へ同じbytesのまま移す。
保管先が置換可能でもasset ID+digestで差し替えを検出し、source/producer recordを共に残す。新しいstorage serviceは必須にしない。
artifact失効・欠落時はrelease acquisitionだけを停止する。別buildを同じreleaseとして捏造しない。
rollbackは旧artifactの単純再buildではない。旧版でも現在必須のendpoint suppression/config/credential契約に適合するものだけを使用する。
旧版が不適合ならcompatible recovery artifactを新candidateとして検証・認可する。release保管の未成立を実装済みと主張しない。

## 残すもの・削除するもの

| 対象 | 決定 | 理由・owner |
|---|---|---|
| 承認したartifactと実際に配布するbytesの一致 | BLOCKを維持 | candidate差し替え防止。release取得/最終handoff |
| 過去の8c2e...をfresh buildの恒久正解値とする手順 | 撤去 | 過去の実証値は履歴。今回選択したartifactがauthority |
| Windows/Linux・異なるcheckout間のexact-byte一致 | routineから撤去 | production builderは1つ。必要なときだけbuild調査/移植test |
| vNext UID canonicalizerとexact page/asset profile | production経路から削除 | raw Astro出力を検証して同じbytesを配布する。rewriteのためのfreezeを不要化 |
| raw/pre-search/final treeの反復full hash | 撤去 | packageの標準digestへ集約 |
| 独自deploy-artifact-manifest CLI/algorithm | release consumer置換後に削除 | 診断目的の全file hashは不一致調査時だけ |
| CSP inline hash・必須headers・private origin漏洩確認 | BLOCKを維持 | 実際に配布するHTML/JS/styleへのsecurity contract |
| _headers LF policy | 低コストな入力整備として維持可 | package作成前に1 ownerが生成。承認後の正規化は禁止 |
| sourceとdistのgenerated _headers二重SoT | 解消 | reviewed security policyからdistだけ生成。通常buildでtracked sourceを修正しない |
| build後の同じstatic/security検証の多重呼出し | 1回へ統合 | 各validatorの責務・検出範囲を失わず呼出し重複を削る |
| Phase別wrapperの再build・再install | 撤去/共有 | 同じrunのbuild outputをconsumeする |
| frozen legacy再現・media再encode | 条件付き | 関係するinput/generator/toolchain/移行・復旧gate変更時だけ |
| live media ref、rights、provenance、recovery binding | 関連変更でBLOCK | Article/公開dataの不変条件は維持 |
| UI/assetの過去サイズ・hash観測値 | 原則record | 必須budget/互換性contractが別途存在する場合のみ条件付きBLOCK |
| read-only診断の段階ごとの承認待ち | 撤去 | 認可済みscope内で収集をまとめる。新credential/外部mutationは別 |

canonicalizerを外す際は、正常なHTML生成・hydration・CSP・searchが成立することを置換testで証明する。
特定pageを丸ごとgolden hashへ再固定する、未知差分を無条件無視する、既存testを消して成功と呼ぶ実装は禁止する。
CSP hash、media content addressing、SOPS/backup、外部AI disclosureのdigestは用途が別であり、一括撤去しない。

## CIを変更影響に合わせる

package.jsonを実行graphの唯一のownerにする。新しいgate registry/DSL/汎用orchestratorは作らない。
通常PRのsource check、test、typecheck、build、final検証を1つのDAGにし、Phase 7/8のconsumerは同じoutputを使う。

| 変更class | 実行 | 通常は実行しない |
|---|---|---|
| docs-only (runtime/config/schema変更なし) | 参照・diff・design review | npm install、site build、media encode、browser capture |
| content/frontend/search | 関連schema/tests + site build 1回 + final検証 | legacy再build、全media再encode、別OSでのproduction再build |
| media input/profile/encoder | 関連media fixture/encode + consumer検証 | 無関係assetの総再生成 |
| build/lockfile/framework/deploy | 影響する全consumer + release transfer/interaction/security test | 目的のないcross-platform hash一致 |
| migration/restore/cutover | 対象baseline/parity/recovery test | 無関係phaseの再監査 |

pathだけで依存影響を決めない。shared schema、validator、lockfile、generator、workflow変更はconsumerへ拡張する。
分類不能なら該当するcore validationへ倒す。SKIPはPASSでなくNOT_APPLICABLEと理由を示す。
PRと同じbranchへのpushによる二重CIをやめ、PRとmain integrationの役割を分離する。
required checkをpath-filterで永久pendingにしない。stable summary jobを実行し、実行/対象外/失敗を集約する。
既存check名変更時はbranch protection/rulesetの実態を先に確認し、利用不能な有料機能や設定変更を暗黙前提にしない。

## 停止条件と再利用

BLOCKは、今回のoperationで守る契約、具体的failure mode、停止する段階、解除に必要な証拠を説明できる場合だけ。
条件付き検証はtriggerが成立したときの失敗をBLOCKし、無関係なstageへ失敗を伝播させない。
source由来の証拠はsource/input/policyが同じ限り再利用する。artifact証拠は選択したimmutable artifactにbindする。
provider現況・credential・sudo等のlive証拠はmutation直前に再確認し、古いsnapshotを使わない。
Server mainの無関係な前進はhandoffを無効化しない。latest同士の相互pinを要求しない。
先行gateが停止しても、既に許可された独立のread-only確認は続け、blockerをまとめて返す。ただし不要な認証・発行・課金は開始しない。

通常の非material修正はchanged-scope review + regression。trust/execution/credential/公開/復旧境界の変更とphase移行は独立監査を残す。
argv/parser変更でもcommand injection等へ影響するならmaterialである。拡張子や変更行数だけで監査を省略しない。
監査者は先に関連SoTからcontractを復元する。作者のself-checkを独立監査と呼ばない。
修正後は関連findingのclosureと影響範囲を再監査するが、無変更scopeを毎回ゼロから監査しない。

## Tempと再発防止

build workerはephemeral CIを優先。workstationはartifact消費用の1 operation rootのみ使用し、毎回node_modulesを作らない。
通常tempとsecret/credential stagingを分離する。非secret性・非実行性・隔離・容量上の問題なしを確認したrootの削除拒否はWARN/P2であり、production gateへ混ぜない。
secret残存、path escape、productionへ効く残骸、ディスク逼迫は影響するscopeをBLOCKする。UNKNOWNは無害とみなさない。
cleanupはroot・owner・理由・remediationを記録し、全pathの件数/列挙をroutineにしない。toolの削除拒否を別toolで迂回しない。

同一目的で予期しないfailureが続いたら、次のpatch前に目的→SoT→依存→根因→直接経路/削除案を見直す。
2回の連続failureは見直しtriggerであって、新たな承認待ち・必須PR・無期限停止gateではない。
比較結果は既存PRの短いdecision noteへ記録する。毎taskに新しい表・hash manifest・監査文書を要求しない。

## 実装・採用手順と完了条件

1. 本proposalのmaterialな変更点を独立reviewし、operatorが明示採用する。既存Accepted ADR本文・証拠は歴史として保持する。
2. 1本の目的が完結するSite実装PRでbuild-once、artifact本体保存/取得、canonicalizer撤去、重複CI整理を接続する。半分だけのconsumer切替で終了しない。
3. package.json、ci.yml、deploy manifest/canonicalizer、security headers CLI/static CLI、Phase wrappers/tests、関連current docsを同時に同期する。
4. 新archive/refが使えるまで旧配布経路を無断解除しない。新artifactを新しくreviewし、古い8c2e...の承認を流用しない。
5. 既存JIT contractによる実配布は別operation。workflow hard block・provider/Article publication/migration gatesは維持する。

必要なtestは以下のbehaviorに限定し、同じpropertyを複数frameworkで再証明しない。
- 通常site changeのbuild 1回、docs-only build 0回、deploy時build 0回。
- Linux-produced artifactをWindowsで取得し同じpackageを使用できる。Windowsにsite build dependencyを要求しない。
- digest/source/run/attempt/configの不一致、expired/missing、unsafe archive、別writer/overrideで停止する。
- 正常なUI変更・generated UID差は過去のpage hashに阻まれず、実interaction/CSP/search testで検証される。
- 不正script/CSP、private artifact、未知R2 binding、endpoint flag違反は引き続き停止する。
- source evidenceの再利用とlive evidence再確認を区別し、stale provider stateでmutationしない。
- legacy/media必要時のtestを残し、無関係な通常変更では起動しない。
- 非secret tempのWARNとsecret/production残存のBLOCKを区別する。

採用時に同期するcurrent SoT: operations/build-artifact-pipeline、validation、development-workflow、deployment-boundary、governance/audit、architecture/design-status、AGENTSのrouting。
Siteの成果物責務だけを変えるため、現在のServer provider pinを単なる最新化のために動かさない。Serverとのmaterial conflictを見つけた場合だけ限定amendmentを行う。

## 外部根拠 (2026-09-25確認)

- [GitHub artifact共有とdigest validation](https://docs.github.com/en/actions/tutorials/store-and-share-data): digest不一致がwarningに留まる経路をfail-closedへ補う必要がある。
- [GitHub workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts): cacheと配布artifactを混同しない。
- [Cloudflare Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/): existing static assetsの配布primitiveを使い、独自upload protocolを作らない。

これらは利用可能なprimitiveの根拠であり、repositoryのcredential/production authorizationを与えるものではない。
