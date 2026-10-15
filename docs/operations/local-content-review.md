---
status: proposed
owner: operations
last_verified: 2026-10-15
canonical_for:
  - local source evidence and independent content audit CLI
---

# ローカル資料と内容review

A3の小単位として、手書き作業稿から資料・根拠・引用・コード例・独立監査を結び、`CONTENT_READY`まで進めます。AI/provider、source fetch、コード実行、画像upload、canonical contentの編集は行いません。決定的表紙/social、Media Registry、画像実物、完全候補previewは[A4の別手順](local-visual-candidate.md)へ進みます。

## 操作

`article init / draft import / revise`は[下書き手順](private-markdown-preview.md)を使います。source/evidence/auditは既存型を参照したJSONを人が準備します。

```text
npm run site -- article sources import --job <job-id> --from /absolute/path/sources.json --json
npm run site -- article examples inspect --job <job-id> --json
npm run site -- article evidence import --job <job-id> --from /absolute/path/evidence.json --json
npm run site -- article audit prepare --job <job-id> --json
npm run site -- article audit import --job <job-id> --from /absolute/path/audit.json --json
npm run site -- article review prepare --job <job-id> --json
npm run site -- article review preview --job <job-id> --json
```

`audit prepare`は固定request hashとprivate artifact pathを返します。独立した人が本文・資料snapshot・引用・claim・例の範囲を確認し、同じrequest hashを持つrecordを作ります。author/reviewerのprincipalが異なること、独立性の申告、全material claimのcoverage、P0/P1不在を検査します。人の実在や申告の真正性を暗号学的に証明する機構ではなく、自己確認を自動的に独立監査へ登録もしません。AI context/Skill lineageの監査importは未実装です。

sourceは`SourceRecord`、evidence/claimは既存schemaを使い、companion型は[共有schema](../../packages/content-contracts/src/article-review.ts)と生成JSON Schemaを正とします。[合成入力factory](../../packages/article-pipeline/src/content-review-fixture.ts)は型の例ですが、実在資料・実際の人の監査として流用しません。実入力のscopeは`human_local`、試験は`synthetic_fixture`で、後者は正式readyを許しません。

source entryはrecord、UTF-8 text snapshot、denyのdisclosure recordです。snapshot bytes hash、locatorのhash、SourceRecord hash、抜粋位置、disclosure policy/refを照合します。disclosureはsource IDを持つartifact subjectとsnapshot hashへ結び、source record自体とのhash循環を作りません。外部送信許可を生成しません。time_sensitive資料には取得時点とfreshness確認が必要です。URLへ接続して真偽や現在性を確認したとは表示しません。binary/photo sourceの取込みはこの入口の対象外です。

`examples inspect`は全fenced codeのID・hash・位置を返します。evidence inputのannotationsはexact-set必須。実行不要な例は明示して`not_run / 未実行`で評価できます。実行や構文検査が必要な例・material claimが依存する例は、有効な取得済みreceiptがなければ`DRAFTED`で停止します。[取得済み例検証の手順](acquired-example-verification.md)で別実行主体の署名付き証拠を取り込みます。分類から「実行済み」「構文検査済み」を生成せず、hostで例を実行しません。コード0件もempty manifestを保存します。

## 引用と追跡

`[@S0003]`は既存lowercase Source ID `s0003`へ一対一に対応します。lowercase stable IDの`[@source-id]`も使用できます。text nodeのmarkerだけを最初の使用順に`[^cite-1]`等へ変換し、同じsourceの脚注は重複しません。コード・inline code・escapeされたliteralは維持し、通常linkを根拠へ昇格しません。論理markerをlink/reference/definitionのlabelとして吸収する記法は拒否し、citation title/publisher/公開説明はMDX安全なtextへescapeします。

未知/noneligible/private source、捏造URL、欠落・孤立・重複脚注、予約脚注label、不正markerは拒否します。source IDを本文の編集で振り直しません。根拠は固定record hashと実snapshotの抜粋へ結び、claimのUTF-16位置と原文、interpretation、ambiguityを照合します。claim spanにcitation marker/fenced codeを含めません。公開向けcompact ledger案にはsource bodyを入れず、private sourceのtitle/locatorも出しません。proposition summaryは公開claim本文から作り、元propositionのhashを別に保持します。実exportのprivacy/全claim coverage受入れはA6に残ります。

## 状態・失効・保存

`CREATED → SOURCES_READY → EVIDENCE_READY → DRAFTED → EXAMPLES_ASSESSED → CONTENT_AUDITED → CONTENT_READY`を既存transitionで再生します。P0/P1または修正要求は`CONTENT_AUDITED → REVISION_REQUIRED`を記録し、`revise`で新attemptから再構成します。terminal stateを巻き戻しません。

A2のimmutable `attempt.json`は書換えず、attempt内のappend-only StageReceiptとatomic headから現工程を導きます。工程別input/outputのexact-set、result、必要な例評価を要求し、保存analysis/audit requestをimmutable本文・資料・根拠から再計算します。監査結論・findingと採用stateも照合してからguide/bundleへ渡します。運用時刻はreceiptに記録し、audit requestの意味上のhashへ毎回の実行時刻を混ぜません。同じ入力は再利用します。旧attempt・監査・supersessionは残します。自動改稿はこの入口にありません。

`working.md`と`working-sources.json / working-evidence.json / working-audit.json`を各操作入口・activation時に再照合します。変更時はguideのcurrentStateをnullにし、旧previewは次requestで410。新attemptへ旧監査を付け替えません。CLI lockは外部editorをlockしないため、前後の再比較を行います。OS上の敵対的同時書換えへのatomic CASは保証しません。

## A4へ渡すbundle

`review prepare/preview`は`mode=content-review`、candidateSha256=null、approvalEligible=false、productionEligible=falseのprivate確認資料です。本文・脚注・compact support・未実行表示・audit・不足条件を表示します。human approval recordは生成しません。

hero/socialの実bytes、Media Registry、visual audit、確定public origin、object-key profile、provider-neutral storage plan、candidate build/previewの未成立を個別に示します。既存site originを仮のmedia originへ流用しません。これらのbindingを消費するA4の条件が満たされるまで、`HUMAN_REVIEW_READY`を発行しません。承認は同state到達後のA5であり、事前条件へ循環させません。

配信は127.0.0.1の / のGET/HEADだけ。no-store/noindex、default-src none、hash固定CSSを使い、job JSONやsource snapshotを配信しません。SIGINT/SIGTERMではlistenを閉じて既存HTTP/TCP接続も終了し、browserの投機的接続がCLI終了を妨げません。通常dist/releaseへprivate bundleを混ぜません。CIは合成fixtureだけを生成し、catalog/feed/search/distへの混入を拒否します。private preview・資料・監査本文を公開CI artifactへuploadしません。

A4画像/完全候補は上記別手順へ接続しています。残件は実運用の例検証器受入れと外部実環境log観測adapter、semantic import、A5本人承認と保存/protection、A6 export/cleanup-safe production検証、A7実記事公開です。native Windows/macOS、Firefox/WebKit/iOS実機の新入口受入れは別途必要です。
