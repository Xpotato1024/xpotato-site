---
status: proposed
owner: operations
last_verified: 2026-10-12
---

# 方式Bの初回手動配信接続：Draft

既存の期限付きWorker限定tokenを再利用し、配布ごとの発行・失効を必須にしない。90日以内・60日rotation・残存7日以上を維持する。初回Site配信確認→新監視Worker→旧Actions撤去の順とし、旧gateをACTIVEと偽装しない。

## review対象の実workflow

このDraftでは [deploy-site.yml](../../.github/workflows/deploy-site.yml) へ [同じ内容のテンプレート](manual-site-deploy.workflow.yml) を反映した。workflow_dispatchだけを入口とし、repository・main・本人actor/trigger・初回attempt・本人の対応可能性をjob guardとCLIの両方で制限する。push/PR/scheduleから配信されない。本人Environment承認とmainのrequired checksを確認する。mainへの適用・Ready/merge・実dispatchは一括判断の対象であり、Draft反映は実配信許可ではない。

正式Production consumer→固定readonly provider GET→pinned Wrangler単発deploy→provider/public readbackを接続する。通常のGITHUB_TOKENのcontents/actions/checks readを使い、管理credentialや新しいprovider権限を要求しない。管理APIのmain保護詳細は読まず、protected状態・required check結果と本人の既存保護設定/GitHub強制へ依存する。読取不能なら停止する。

成功したexact main push runのartifactを正式consumerでarchive digest・source/config・staging bytesまで再照合する。artifact sourceとworkflow現在mainの祖先関係、公開build入力・実行script・保留manifest・Server authority文書を照合する。手動配信専用scriptとテスト差分は公開build入力から除く。再build・PR candidate・asset/config override・保留解除は認めない。保留44記事IDを選択sourceの正本から読み、distのID混入・raster・data URIを拒否する。

## 一度の設定に使うcontext全フィールド

非秘密Environment変数 `CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON` のschemaは次のとおり。秘密値を含まない。余分なfieldは拒否する。

```json
{
  "accountId": "<existing_account_id_32hex>",
  "ownerPolicyReviewed": true,
  "tokenPolicy": {
    "createdOnUtcDate": "YYYY-MM-DD",
    "issuedOn": null,
    "reviewSource": "owner-created-and-saved-token"
  }
}
```

- accountId：既存の非秘密metadataから再利用する。未取得なら本人Dashboardのaccount IDだけを埋める。全account列挙の追加権限を要求しない。
- ownerPolicyReviewed/reviewSource：本人が既に指定Worker→xpotato-site→Editorで作成・保存した確認を引き継ぐ。同じscope確認やsecret再入力を要求しない。scope全体のlive読取は行わず、`scopeLiveReadback=false`を記録する。
- createdOnUtcDate：本人確認済み作成日のUTC日付。secret更新時刻を正確なtoken発行時刻と呼ばない。
- issuedOn：通常null。日付のUTC 00:00を保守的な下限として90日上限/60日rotationを判定する。境界で停止した場合だけ、既存token detailsの正確なUTC発行時刻を非秘密metadataとして埋められる。現在時刻を発行時刻として生成しない。

workerTagは固定accountのxpotato-siteを一意に解決する。zoneIdは[公式domains API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/)のxpotato.net・対象Workerの行から実取得し、enabled=true/previews_enabled=false・operation中zone不変を確認して、そのzoneのroute GETだけを許可する。全zone列挙を追加しない。deployTokenId/readonlyTokenIdは各credential自身のverifyから実取得し、別ID・operation中の不変を確認する。permissionGroupIdの自己比較pinはscopeの追加証明にならないため削除した。expires_on/not_beforeもverifyで読む。expiryの欠落・無期限・期限/rotation超過は停止する。not_beforeが欠落してactiveの場合は欠落を明示し、時刻を作らない。日付下限の判定は厳しめなので、90日境界では正確なissuedOnがないと停止し得る。

## 初回配信前後の実確認

readonly tokenは既存の監視read secretをそのまま使う。fixed account/Worker/zoneのGETだけで、Worker tag、先頭active deployment/version、bindingsなし、domain集合、固定zone routesなし、workers.dev/preview無効を確認し、直前driftを拒否する。全履歴・別zone routes不存在をlive証明したとは主張しない。domain/route完全性metadataや権限が不足すれば配信前停止し、scopeを自動追加しない。

token自身のverifyでid・active・expiryと存在するnot_beforeを確認し、初回実取得値をoperation中に固定する。`scopeEvidence=OWNER_CONFIRMED_SPECIFIED_WORKER_EDITOR`と時刻根拠を分けて記録する。本人確認済みEditor設定を毎回質問せず、旧audit-readの直前発行要求も使わない。

本人の残確認は「今回の配信直後に失敗/unknownを受けたら本人が対応できるか」である。token作成によって確認済みのDashboardアクセスやscopeを再質問しない。現在のprovider versionと公開home 200を実GETで確認してpreimageを保存し、復旧候補として退避する。別の旧artifactを本人に毎回準備させない。回復操作成功を事前に認定せず、失敗時にはこの記録を見て本人がDashboardで停止・復旧判断をする。

preimage保存後だけpinned Wranglerを一度起動する。子processへ配信用tokenとaccountだけを渡し、GitHub/readonly tokenを渡さない。生出力を公開せず、再試行・rollback・失効を自動実行しない。実version一致、代表7ページ/参照assetと全Astro CSS/JSのbyte hash一致、代替endpoint404、同token有効を満たす場合だけ成功とする。失敗/unknownは本人対応へ戻す。反映遅延でもdeployを再試行しない。

## 一括判断と範囲

contextの非秘密値、期限判定、本人の今回の対応可能性、PR94の最終head/CIを一つに揃え、本人がmainへの適用と今回の単発配信を判断する。環境の既存本人承認を通してdispatchし、既存保護を緩めない。token有効性はsecret存在から推測せず実verifyで判断する。無期限/不適切scopeなど設定変更が必要な実結果が出た場合だけ、必要な変更を別途具体化する。

offlineではmanual-only guardの危険側変更、controller停止/一回実行、provider/HTTP、credential隔離、正式artifactの公開範囲を検証する。metadata診断は常にcredentialValidity=UNVERIFIED/deployAllowed=false。Draft段階で実provider・credential・配信成功は未確認である。

## 旧validatorからの移行検証

repository validatorの旧literal-false専用呼出を、実workflowのmanual/main/owner/Environment/正式Production consumer検査へ置換した。設定authorityの宣言を保持し、検証削除ではなく危険側変更を拒否する検証へ移行する。旧PR65 artifactとのpackage比較では、このrepository-cliのレビュー済み旧blob→新blobだけを正確なfull Git blob IDで許容する。path/mode・他の全package blobを照合し、任意のvalidator変更やpublic renderer/config変更は拒否する。作業pathはjob envでrunner contextを参照せず、各stepのRUNNER_TEMPから同じ式で設定する。

## verifyの非秘密診断（診断準備、未実行）

[公式account token verify schema](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/verify/)では `expires_on` と `not_before` はoptionalである。診断では有無・型・判定状態と固定reason codeだけを記録し、生token ID、日時、API本文、credentialは出力しない。期限省略/無期限は配信安全条件を満たさないため停止し、`not_before`省略はactiveの既存扱いを維持する。UTC Z以外の日時を今回独断で受理しない。

既存手動workflowの `diagnostic_only=true` は、同じmain・本人actor/trigger・attempt1・Environment承認・正式artifact/GitHub検査を通した後、配信用token自身のverify GETだけを一度行い、`token-diagnostics.json`を保存して終了する。provider inventory、Wrangler deploy、public readback、rollback、失効へは進まない。`deployAllowed=false`、`deployCount=0`、`providerWrites=0`を明示する。push/PRから診断も配信も実行されない。

実診断1回は本人の続行指示を受けたが、現在mainにこのmodeがないため本Draftのmain反映が先に必要である。merge許可は別途確認する。反映後は既存のartifact選択inputsを維持して `diagnostic_only=true`、既存guard用の `owner_recovery_ready=true` を指定し、新しいrunを一度だけdispatchして本人Environment承認を通す。前回失敗runのre-runはしない。結果がblockedでも診断結果として保存し、原因確定後の設定/配信は別判断とする。
