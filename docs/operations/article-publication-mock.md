---
status: proposed
owner: operations
last_verified: 2026-10-15
canonical_for:
  - A5 and A6 local mock publication and export workflow
---

# 候補承認・mock保存・非公開export

[A4](local-visual-candidate.md)の固定候補から、承認とsource→public→protected→exportの境界を実装する単位です。この段階の保存adapterはローカルmockだけです。実resource、資格情報、権限、Cloudflare、公開、merge/deployの受入れを意味しません。

## 本人lane

~~~text
npm run site -- article approve --job <job-id> --candidate <full-sha256>
~~~

現在のhuman_local正式候補、HUMAN_REVIEW_READY、本文・画像・監査・保存計画・候補hashの一致を再検証します。本人が直接操作するTTYで識別名・確認内容・完全hashを入力します。非TTY・CIは停止し、任意JSON、AI response、--yesによる承認入口はありません。

実装・試験担当は本人入力を代行しません。このPRでは実際の本人承認recordを作成しません。TTYとローカルファイルは本人性の暗号学的証明ではなく、端末全体を書き換えられる攻撃者への対策とは主張しません。候補承認だけでは実保存・公開・設定変更を認可しません。

## mock lane

~~~text
npm run site -- article approve --mock --job <synthetic-job> --candidate <target-sha256> --json
npm run site -- article media plan --job <synthetic-job> --candidate <target-sha256> --json
npm run site -- article media source-store --mock --job <synthetic-job> --candidate <target-sha256> --json
npm run site -- article media publish --mock --job <synthetic-job> --candidate <target-sha256> --json
npm run site -- article media protect --mock --job <synthetic-job> --candidate <target-sha256> --json
npm run site -- article publication validate --mock --job <synthetic-job> --candidate <target-sha256> --json
npm run site -- article export --mock --job <synthetic-job> --candidate <target-sha256> --json
~~~

mockはsynthetic_fixtureの参考候補だけを受け入れます。模擬decisionは別protocolで、HumanApprovalRecordへ変換しません。通常の内容/画像journalを承認済みへ進めず、attempt配下のpublication/mockへ独立したsimulationを保存します。guideではMOCK_状態と承認不可を区別します。init時のpublish intentは権限上限にすぎず、実操作認可ではありません。

source/public/protectedのmock objectはprivate rootの.mock-media-provider配下に保存します。jobを再開・作り直してもprovider側の同じbytesを保持します。通常buildや公開artifactへ添付しません。

## exact persistence

候補、attempt、入力、decision、plane、key、bytes、metadata、policyをoperation intentへ結びます。asset別の権利・variant対応を保持し、物理objectはkeyのunionとして一度だけ保存します。同一keyの異bytes/size/type/cache/policyを上書きしません。

各stageは前stageの完全receipt、同一候補、権限上限、mock capability、完全なobject集合を再検証します。保護時はpublicの実bytesと別planeの保護bytes・policy・保護参照を読み取ります。receiptのhashがあるだけでは成功としません。

不明な書込み結果はblind retryしません。pending intentを保持し、次の実行でも同じproviderの状態を読みます。同一objectを確認できればreuse、確定した不在なら同じintentを再試行し、read結果も不明なら停止します。検証済みobjectの消失は自動修復せず停止します。public成功/protection失敗ならexportせず、既存objectや履歴を削除しません。

保存receiptとpost-approval lineageの追加は候補本文を変えません。本文・根拠・rights・画像・profile・route・build入力の変更後は旧承認を利用できず、reviseと新候補・新承認が必要です。

## export と cleanup 後の境界

exportはprivate stagingに、候補そのもののMDX、Media Registry、rights、compact SourceRefs/materialClaims、canonical source identity、receipt hashとexact recovery binding、base preimage、許可されたpath集合、patchを作ります。実working treeやmainへ適用しません。合成更新fixtureは前exportのsnapshotを固定したprivate modelをbaseに使い、通常content treeへ記事を挿入しません。modelのpreimageと実checkoutの不変性を別に検証します。部分欠落、余計なpath、base競合、未保護objectは成功扱いにしません。

mockのJSON envelope、内側の予約保護参照mock-only-protected-、private sentinel、通常buildを停止するindex projectionを保持します。envelopeを外しても通常のcompact validatorと公開出力guardで拒否します。mock patchを実出版recordへ流用する入口はありません。

jobが参照できない新しいprivate fixtureでは、export済みcompact recordsとmock protected objectsだけを読み、共有のAstro layout・画像resolverで描画します。これは本番checkoutの受入れではありません。通常build/releaseが同じmockデータを拒否することと分けて検証します。実データのloader強制置換や未投入rights台帳の全域必須化は行いません。

## 更新

ContentIdを維持し、本文のみ・タイトル/social・hero差替え・主分類・タグを合成fixtureで検査します。変更した現revisionだけをexact-setとし、旧source/public/protected objectを削除しません。同じbytesも新候補のread-backとreceiptへ結びます。

Blogの新規URLはContentIdから自動生成し、本文・title・hero・主分類・タグの更新で維持します。`--slug`は不要です。凍結旧URLからID URLへの移行計画は同じContentIdに結び、既存path／redirectの衝突・cycleを検査します。旧44記事のhold解除には使用できません。

## 検証と実運用の残件

publication:isolation:prepareは、合成候補・stage順序・変更後失効・保存/保護・export・job不可視のprivate描画・5更新経路でのID URL不変性を実行します。publication:isolation:checkは通常distへのmock情報流出を検査します。通常releaseのsite buildは1回です。private buildはA4の1回と本fixtureの候補6回・cleanup描画1回で合計8回です。

実provider用のsource-store/publish/protect/exportはLIVE_MEDIA_RESOURCES_AND_OPERATION_AUTHORIZATION_NOT_ESTABLISHEDで停止します。Serverのexact counterpartとsource/public/protected設計profileは維持しますが、実resource・権限・policy read-back・個別操作認可・本人の実候補承認は未成立です。実保存、公開、cleanup、Ready化、merge、deployは別工程です。
