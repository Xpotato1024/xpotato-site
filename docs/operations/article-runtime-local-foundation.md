# Article runtimeのローカル契約実装

対象は`feat/article-runtime-foundation-20261030`。記事準備の14 files / base `453c575faf8aa84bb9a057c612dec4415ed78c29` と分離した追加差分です。外部へのpush/PRは再試行せず、実provider通信・AI利用料・storage upload・認証/権限変更は行いません。

## 実装した部品

| 部品 | ローカルで動く範囲 | 動かしていない範囲 |
| --- | --- | --- |
| `RuntimeOperationJournal` | immutable intent/result、binding・hash・予算・lock、期限/取消し、pending/unknown再送拒否 | Article Jobの正式state変更、human記録、実receipt、provider結果不明のreconciliation |
| `prepare/runSemanticInvocation` | 既存disclosure compiler、物理Skill/reference/schema集合、strict schema、profile/model/response lineage、最大15回とstage別上限、private出力hashと再読取 | 実provider adapter、API key取得、課金呼出し、正式semantic job/stageへのimport |
| `createServerConditionalMediaWriter` | exact descriptor、15分以内session、fresh policy/承認callback、conditional PUT requestの構築、前後のbytes/metadata検査、public/protected一致、sidecar journal連携 | 実R2 signer、bucket発見、credential生成、実PUT、正式保存receipt/export |
| `article runtime inspect-*` | `.local`内のbounded secret-free JSON検査。通信なし、job不要。返値は常にliveReady=false / productionEligible=false | session取得・接続、観測stateの自己申告、admission authorize、run/upload |

writer/runnerは`operator_runtime`を拒否します。構築自体は通信しません。test_fixtureでは明示注入したin-memory callback/HTTP応答だけを使い、native fetchや実providerへ接続していません。fixture用の外部利用permissionや応答metadataを、対象3D記事のadmission/実runへ転用しません。

保存writerのcallback `assertApproved` は、接続時に同一candidate・human approval・phase別の既存前提receiptを実検査する必要があります。callback名、descriptorのhash、`verified`というsidecar結果だけでは承認の証明になりません。現在のCLI live gateとhuman専用schemaは維持します。

```text
npm run site -- article runtime inspect-session --from .local/session-descriptor.json
npm run site -- article runtime inspect-request --from .local/request-descriptor.json
```

session JSONは`mediaWriteSessionDescriptorSchema`に従うmetadataだけです。headers、secret、private origin、署名URL、callback、provider bucket/account値を入力しません。request JSONは既存requestとmanifestだけで、physical payload admissionやSkill eligibilityを検証済みとは返しません。現在のdenyをinspectで上書きしません。

## 未接続と未観測

Server authorityは`ab9328c5a58082ac1ec268aa7d5901d838a6a474`のまま。Siteの実装へbucket名やcredentialの第二SoTを追加しません。[Server desired](https://github.com/Xpotato1024/Xpotato-Server/blob/ab9328c5a58082ac1ec268aa7d5901d838a6a474/inventory/desired/cloudflare.yaml)と[readback/作成手順](https://github.com/Xpotato1024/Xpotato-Server/blob/ab9328c5a58082ac1ec268aa7d5901d838a6a474/docs/operations/website-r2-ac-creation.md)を参照します。

次表の名前と条件はdesiredの参照で、実観測ではありません。current inventoryのBは2026-08-15 operator確認の履歴に留まり、A/C不存在、現policy正常、実receiptを捏造しません。親側も認証済みprovider sessionは未確立です。

| operatorが既存Dashboard/許可済み接続で読む対象 | 必要な具体的観測 |
| --- | --- |
| account/zone | Server inventoryのselectorと現在のaccount/zoneが一致。複数accountを推測で選ばない |
| R2全体 | default/eu/usの全paginationと利用可能jurisdictionを確認。403、timeout、未完一覧を不存在としない |
| A `xpotato-site-prod-source` | 存在、private、public custom domainなし、r2.devなし、自動expiryなし。raw originalでなくcanonical master用 |
| B `xpotato-assets` | 既存assets.xpotato.netとnamespaceを保持。公開domain・cache metadata・exact keyのbytesを確認。再作成や削除はしない |
| C `xpotato-site-prod-protected` | 存在、private、whole-bucket Indefinite Lock、expiryなし、public endpointなし。ruleが全対象を覆うことを確認 |
| writer/reader分離 | 既存権限のscope・有効期限をoperator側で確認。source/public/protectionを混用せず、設定/lock/Delete能力を通常jobへ渡さない。secret値を画面取得・転記しない |
| Worker | R2 bindings=0など、固定Server契約の現況を確認 |

現在の実行環境では固定WSLと私有Windows CLI双方の`wrangler whoami`が未認証でした。bucket/object GETには到達していません。既存Dashboardにも未サインインなら本人operatorのサインインが必要ですが、この作業ではログインや認証変更を行いません。

実object操作には、正式候補/権利/監査/承認に束縛されたexact-key・短期限のServer sessionが別途必要です。child発行が必要なら資格情報生成の別認可を要し、現作業では発行しません。今回のHTTP条件と応答処理はcontract fixture検証であり、実R2の署名・conditional header・status・policy反映を受け入れた証拠ではありません。

## 次の採用判断

[ADR-0060](../design/adr/0060-article-runtime-transport-sidecars.md)に、正式semantic scope、Server session factory/IPC、unknownのreconciliationを分けて記録しました。まずローカル部品をレビューし、実Server接続と正式jobへの採用を別に確認します。本番Article Job activationや人間承認を、部品試験の成功から導きません。

## 2026-10-31のローカル復旧追加

main `9e1a2443bbcced4970325d0b595723ff19138b5c` の部品を再利用し、結果不明の読戻しとsession受渡しの検査を追加する。PR128の表示修正・PR125のPrime採用とは独立した変更で、以下もtest_fixture限定である。

- `RuntimeOperationJournal.reconcile` はpending/unknownの元intent/resultを保持し、操作・attempt・入力・context・元resultに束縛した別の不変記録を保存する。呼出し前後のpreflight、10秒以内の期限、取消し、今回の呼出し中の観測時刻、最大3回の読戻しを検査する。例外や遅延完了はunknownのままで、生の例外を保存しない。
- `inspectRecovery` は保存記録のhashと元操作との対応を再検査する。これは履歴の読取でありfreshな観測ではない。同じrecovery IDを再実行して履歴を上書きしない。元の`run`は復旧記録の有無にかかわらずpending/unknownを再送しない。absentの読戻しも再送許可ではない。
- `reconcileMediaObjectWithJournal` は既存writerのread-only読戻しを使う。freshな承認・policy、exact keyのbytes/hash・長さ・Content-Type・Cache-Control・policy・protected参照を検査する。protectedは対応するpublic bytesも必要とする。署名取得・PUTは呼ばない。verifiedのoutput hashは**現在観測したobject bytes**のhashであり、失ったPUT応答や「誰が保存したか」の証明ではない。
- `openFixtureMediaSession` は注入されたServer-owned factoryから得たsessionを、要求したauthority・job/candidate/approval/policy・完全なobject集合・最大有効期限へ束縛する。metadataとcallback参照をsnapshotし、JSONから関数や署名URLを作らない。実factory、credential lookup、bucket発見、IPC/署名実装、CLI接続は追加しない。providerの認証が成立したとは返さない。

復旧記録は`scope=test_fixture / productionEligible=false / formalReceipt=false`である。媒体の実保存receipt、human承認、正式Article Jobのstate、公開admissionやcleanupを進めない。semanticの正式Job接続も未実装のまま。次の接続ではhuman_localを再利用せず、typed semantic scope・stage receipt・独立監査lineageとこのsidecarとの対応を設計・検証する必要がある。

Server接続のproduction形態（信頼された同一process factoryかoperator-owned IPCか）は未選択。実Server session・fresh provider policy/bytes・署名とcredentialを所有するprincipalの確認は別の接続条件であり、fixtureで補わない。実provider通信、AI利用料、storage upload、認証/権限変更は実行していない。
