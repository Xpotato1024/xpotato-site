---
status: proposed
owner: content
last_verified: 2026-10-30
---

# 記事公開準備：実装済み経路と未実装の境界

main `880bdf64c9cb7e768ac55ae3ffbf7d92da8e8627` と、その後の3D記事の非公開準備差分を調べた実装記録です。設計の採用、外部AIへの入力admission、保存成功、記事公開を示すものではありません。PR125のPrime UIとは別ブランチです。

## 実行入口の確認

`npm run site -- article ...` は `scripts/site.ts` → `packages/article-pipeline/src/cli.ts` です。

| 対象 | 実装と確認結果 | 切り分け |
| --- | --- | --- |
| semantic request/response | `semantic-provider.ts` はrequest fingerprint、job/stage/manifestの一致、UTF-8/JSON/出力上限を検査。`ProviderNeutralSemanticAdapter` はinterfaceのみ | 検証APIはある。実provider adapterと実行・importをjobへ接続するrunnerは未実装 |
| AI authoring CLI | `article init --authoring` はhumanだけを受け入れ、それ以外は `AUTHORING_MODE_NOT_IMPLEMENTED`。evidence/authorのprepare/run/import一式はCLIにない | 文書のCLI target shapeを実装済みとは扱わない |
| 内容review | `sources import` → `evidence import` → `audit prepare/import`。source scopeはhuman_local / synthetic_fixture、監査recordのreviewer.kindはhumanのみ | agentの準備資料や独立レビューをhumanへ偽装して取り込まない |
| live activation | `liveSemanticProviderEnabled=false`。既存のdisclosureはdenyのまま | 公開許可をprovider呼出しや入力admissionへ読み替えない |
| source/public/protected保存 | `media-persistence.ts` の3 portはinterface。実writer実装はない | 未接続だけではなく、live adapterが未実装 |
| publication journal | `PublicationPort` とoperation intentはmock専用。CLIの実保存/exportは `requireLivePublicationResources()` で停止。human headも保存済みreceiptを持つ状態を拒否する | mock journalをliveへ改名して使わない。live journal/receiptの再検証・復旧が未実装 |
| HTTP readback | `createServerMediaReadbackPort` は実GET transport。Serverが渡すexact-key session、15分以内の有効期限、固定authority、origin/bytes/timeout/redirectを検査 | readback実装はあるが、Server sessionのfactory/CLI接続はない。保存機能ではない |

repository全体の参照検索でも、上記semantic adapter / media writer interfaceの実装や、テスト以外からのServer read session構築は見つかりませんでした。別サービスに存在しないという証明にはしません。

## 接続済み読取経路の確認

この実行環境の固定Wrangler `4.151.3` で `wrangler whoami` を実行し、`You are not authenticated. Please run wrangler login.` が返りました。login、temporary account、token取得・表示・コピーは行っていません。関連環境変数も値を表示・保存せず、設定有無だけを確認しました。

利用可能なtool catalogには、このrepositoryのCloudflare/R2を読む専用接続はありませんでした。別製品Sitesの管理toolをこのWorkerの認可として流用しません。Computer Useの初期化に必要なnode_replも当該catalogにないため、別のWindows自動操作経路を独自実装しません。

結果は **BLOCKED_ENV / A/B/C未観測** です。bucket一覧取得やobject GETまで到達しておらず、providerの403、bucket不存在、lock未設定を観測したという意味ではありません。GitHub読取は利用可能ですが、Gitのdesired/current inventoryはfresh provider sessionの代替ではありません。

authorityはServer `ab9328c5a58082ac1ec268aa7d5901d838a6a474` のままです。同版の `tools/website_r2_ac_plan.py` はobservationを検査するno-apply plannerで、Cloudflare clientやsession取得機能を持ちません。fresh observationはdefault/eu/usのpagination完了、account/zone、B、A/C、privacy/lifecycle/lock、Worker bindings=0を既存の許可済みServer/operator接続から取得する必要があります。未取得値を仮入力してplannerをPASSさせません。

## 必要な実装差分と認可の境界

次のローカル実装・テスト・非配信branch/PRは、既存のサイト公開準備・commit/push許可の範囲です。現在のguardを削除するだけの変更では成立しません。

1. semantic job用のprepare/run/importとimmutable journalを接続する。fixed Skill/reference/response schema、実input artifact集合、job/attempt/state、上限、request/response/run identityを保存・再検証する。human_localとは別のtyped scopeと監査lineageが必要で、human approverは引き続き別役割とする。
2. 既存のdisclosure compiler/transportへ実adapterを接続する。external/backendの実態に合うexecutionModeを記録し、deny/unknownを止める。現在のagent sessionをlocal backendと偽称しない。実provider利用・exact inputsのadmission・利用可能credentialは別の運用条件で、実装テストのfixtureで代用しない。
3. Server所有のsessionを受け取るwriter adapterとlive journalを実装する。locator/signing/credential/policyの第二SoTをSiteに作らず、exact key、conditional create、同bytes再利用、異bytes停止、pending/unknownの読戻し、取消/期限/失敗復旧、同candidate/approval bindingを検証する。
4. live source/public/protection receipts、compact recovery/support ledger、exportを再検証する経路を接続する。mockとliveのrecordを分離し、未確認のreadbackやunknownを成功へ変換しない。

実resource操作、新credential発行、権限拡大、lock設定は上記コード変更の許可に含めません。既存sessionが接続できればまず読取を行い、実保存前には確定候補とmedia操作の対象を再照合します。

## 今回進めた記事側の準備

- 公式iconを複製する `slicers` Figureとcreditだけを除き、製品名の文字見出し・設定名・8模式図を保持。現在のMDX SHA-256は `90fe669e994215f5ee20f6fc6329f4c4d857cdcafe9b320d4d59178c9bc69585`。51 claimの文言は変えず、body span/hashを再対応した。
- ロゴのない既生成heroの正式Library受渡しが成功。原JPEGは114,126 bytes、1200×675、SHA-256 `856bfb5ee390e11acad15167de423adc93a2b014d9f5b6404780a2de4480f9a0`。生成・本人採用の出所は私有記録に保持し、旧icon合成版のhash/generation identityを同一ファイルとして転用しない。原画像はGitへ追加しない。
- 空のcomposition slotの記録は保全し、新JPEGから新canonical/previewを生成。preview rendererは公式iconを取得せず、8模式図だけを描画する。hero・8図・C socialの10 assetsは私有fixtureのまま。正式visual audit、候補承認、A/B/C保存成功とは区別する。
- 22資料の派生snapshotは全て262,144 UTF-16 units以内。45 evidence/source対応・78抜粋について元bytes、変換、record/disclosure hashを検証。PDFの小回転・線形弾性条件と式を含むページを保存し、式の文字順序乱れはPNGとの対応で明示する。正式intakeやhuman監査recordは生成していない。
