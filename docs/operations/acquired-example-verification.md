---
status: proposed
owner: operations
last_verified: 2026-10-15
canonical_for:
  - acquired example verification receipt import
---

# 取得済みコード例検証の取込み

執筆CLIは対象コードを実行しません。別実行主体が作成したEd25519署名付きreceiptを、固定request・入力bytes・profile・実装/toolchain pin・実行主体と照合します。構文検査とsandbox実行を区別し、分類だけ、未実行、失敗、入力/出力不一致を成功にしません。

## 手順

1. 手書き本文とsourcesを固定してimportします。
2. evidence JSONの各fenced codeへannotationを付けます。`requestedVerification`、`verificationRequired`、依存するmaterial claim IDsを指定します。既存receiptを付けたまま新attemptへ流用しません。
3. SOURCES_READYで、`npm run site -- article examples prepare --job <id> --from /absolute/path/evidence-plan.json --json`で非公開request artifactを作ります。stdoutへcode/source snapshotを出しません。
4. 別実行主体へその固定requestを渡し、対応するreceiptを取得します。このCLIに任意実行command、runner起動、network fetch、install機能はありません。
5. evidence JSONの`verification.receipts`へreceiptを添付し、通常の`article evidence import`へ渡します。合成試験だけは`verification.fixtureTrust`を使えます。実入力のscopeにfixture公開鍵を持ち込めません。
6. `EXAMPLES_ASSESSED`になった後に独立content auditへ進みます。失敗/未取得は`DRAFTED`で止まり、auditを開始しません。既存evidenceを変更する場合は`revise`で新attemptを作り、新requestに対する証拠を再取得します。

手書きのcodeなし記事、または実行不要でmaterial claimが依存しない例は従来どおり進められます。取得済み証拠がない重要な実行依存claimを省いて合格にする入口ではありません。

## 信頼と固定値

requestはjob/attempt/spec/input、本文、source bundle、receiptを除くevidence plan、著者principal、example ID/source bytes、検証class/profileへhash結合します。同じ内容でも別attemptのreceiptを付け替えません。完全一致した同じ入力だけを再利用します。

[共有schema](../../packages/content-contracts/src/example-receipt.ts)と[policy](../../packages/example-verifier/src/receipt-policy.ts)を使います。Ed25519署名のdomainを固定し、SPKI公開鍵bytes hashを照合します。公開鍵のcurrent status、run時点の有効期間、別principal、許可profile/implementation/toolchain/runtime/verifier versionを照合します。失効key、未知key、自己検証、scope不一致は拒否します。

[実運用のtrust store](../../packages/example-verifier/src/trusted-runners.ts)は空です。本変更は実運用key、credential、権限、サービスを作成/登録しません。実運用で受け取るには、別実行主体の公開鍵fingerprint/principalと、レビュー済み実装・toolchain・profileのexact hashを別途固定する必要があります。非公開keyはGit/job/CLI出力へ登録しません。

署名は信頼済み実行主体の申告を認証します。消費側だけでremote OSの実行や隔離を再観測した証拠、または署名者による虚偽まで検出する仕組みとは主張しません。運用採用はその固定実行器のレビューと受入れを必要とします。fixture keyは試験中だけ生成し、private keyを永続化/出力せず、実運用trust storeへ追加しません。

## 検証結果と出力

成功にはexit 0、signalなし、completed、profileの15秒以内、UTF-8入出力hash/size一致、combined output 1 MiB以内を要求します。timeout/resource kill/deniedを成功にしません。失敗後にlimitを緩めてretryしません。計測上の終了遅延は失敗receiptに記録できますが、成功の上限は変わりません。

`syntax_checked`は構文/型だけ、`sandbox_executed`は固定された小さいsandbox環境だけです。sandbox baselineは既存`example-sandbox-v1`の完全hashへ結びます。取り込むだけのCLIにhost実行許可は生じません。

annotationに`expectedStdoutSha256 / expectedStderrSha256`を指定した場合、processが成功しても取得済みbytesと違えば検証不合格です。output fenceを観測済みにするには`requestedVerification=evidence_observed`と`observedOutput={fromExampleId,stream}`を指定し、成功した同じ署名済みsandbox実行のstdout/stderrへUTF-8 byte一致させます。parser passから動作/観測成功を作りません。末尾LFもbytesの一部です。異なる外部実環境のlog観測adapterはこの入口の対象外です。

不足receipt、検証不合格、未実装profile、署名済み環境不足を機械的に分けます。evidence importは不合格/未取得を記録しても成功exitにせず2、署名済み環境不足は4を返します。どちらもDRAFTEDとblockersを出力し、監査へ進めません。環境不足はresourceOutcome=environment_unavailableで、成功と同一視しません。

reviewは必要class・依存claim・expected hash・出力照合条件・実結果・限界・receipt/request/trust/profile hashを表示します。取得済みraw stdout/stderrはjob内の非公開artifactに保持し、HTTPでsource snapshotやreceipt JSONを配信しません。編集後は旧auditとpreviewが失効します。

## 試験の意味

CIの別プロセスfixtureは固定JSON parserだけを実行し、正しい/壊れたJSONの実際のexit/stdout/stderrを署名します。対象JSONをコードとして実行しません。Node/Python/SQLite sandboxの署名整合fixtureは合成証拠で、実際のsandbox作動確認ではありません。全て`synthetic_fixture`で、正式候補・本人承認・公開の権限はありません。

profile IDは現行`verificationProfiles`を正とします。Node/Python/SQLiteでもsyntax-onlyを選べますが、実行時とはoperation class・mode・完全profile hashが異なり、parser向け許可をruntimeへ昇格できません。初期文書の旧別名を暗黙に同一profileとして受理せず、profile/runtimeの意味が変わればhashと後続監査を失効させます。AI/provider、source fetch、画像生成、upload、本人承認、exportの追加は含みません。
