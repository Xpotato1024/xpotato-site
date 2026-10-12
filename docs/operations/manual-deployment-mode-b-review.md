---
status: proposed
owner: operations
last_verified: 2026-10-12
---

# 方式Bの手動配信接続：Draft

既存の期限付きWorker限定tokenを再利用し、配布ごとの発行・失効を必須にしない。`deployment-persistent-policy.mjs` の90日以内・60日rotation・残存7日以上を維持する。初回Site配信確認→新監視Worker→旧Actions撤去の順とし、旧gateをACTIVEと偽装しない。

## 実接続案

[手動workflowテンプレート](manual-site-deploy.workflow.yml) と `scripts/release/manual-deployment-cli.mjs` が正式Production consumer→実provider GET→単発Wrangler deploy→provider/public readbackを接続する。テンプレートは `.github/workflows` 外に置くため、このDraftのpush/PRから配信されない。既存 `deploy-site.yml` の全jobは無効のまま。Ready・merge・workflow有効化・設定変更・live実行は別途判断する。

手動main dispatch・本人actor/trigger・初回attempt・本人Environment承認と既存保護を照合する。通常の `GITHUB_TOKEN` のcontents/actions/checks readを用い、追加の管理credentialを要求しない。branchのprotected状態・required check実結果は読むが、管理APIのmain保護詳細は読まない。保護詳細の維持は本人設定reviewとGitHubの強制に依存する。APIが読めなければ停止し、権限を自動追加しない。

選択artifactは成功したexact main push runに限定し、正式consumerでarchive digest、source config、staging bytesを配信前に再照合する。workflow現在mainとartifact sourceの祖先関係・公開build入力を照合し、古いartifactを最新mainとして扱わない。再build・PR candidate・asset/config overrideは認めない。保留44記事IDの正本を選択sourceから読み、公開distへのID混入・raster・data URIを拒否する。

既存readonly tokenで固定account/Worker/zoneのGETだけを行う。target tag、active deployment/version、bindingsなし、domain集合、固定zone routesなし、workers.dev/preview無効を確認し、直前driftを拒否する。deployment履歴は公式の先頭activeページを確認し、全履歴completeとは主張しない。domain/routeの完全性metadataが欠ける場合は停止する。別zoneへのroute不存在はlive証明しない。本人の初回設定照合の対象であり、今回の無権限追加境界を超えて全zone inventoryを要求しない。

deploy tokenは自身のverify endpointだけへ渡し、id・active・not_before・expiryを実照合する。scope全体/発行日時は本人がCloudflareの既存token detailsで確認したpinを使う。`scopeEvidence=OWNER_PINNED_INITIAL_POLICY`、`scopeLiveReadback=false`を記録し、全policyをlive検証したと主張しない。verify応答に必要時刻がなければ停止する。旧audit-read adapterの直前発行要求は使わない。

preimageを保存後、pinned Wranglerを一度だけ起動する。childへは配信用tokenとaccountだけを渡し、GitHub/readonly tokenを渡さない。CLI生出力はログへ出さず、再試行・rollback・失効を自動実行しない。成功は実version一致・代表7ページ/参照assetと全Astro CSS/JSのbyte hash一致・実version previewを含む代替endpoint404・同token有効まで確認した場合だけ。失敗/unknownは `STOPPED_OWNER_RECOVERY_REQUIRED` として本人対応へ戻す。公開反映遅延も失敗扱いであり、deployを再試行しない。

## 本人が一度だけ確認する設定

配信用secretは `site-production` の `CLOUDFLARE_SITE_API_TOKEN`。秘密値は本人が直接入力し、AI/chat/local fileへ渡さない。監視read tokenへwrite/admin scopeを追加しない。

非秘密Environment変数 `CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON` を一つ提案する。accountId、workerTag、zoneId、deployTokenId、readonlyTokenId、permissionGroupId（各32桁hex）、ownerPolicyReviewed=true、tokenPolicy（issuedOn/notBefore/expiresOnのUTC時刻、reviewSource=`owner-cloudflare-token-details`）を含む。scopeはallow1・対象Worker Editorだけ・追加policyなしで本人照合する。tokenPolicyは更新/rotation時だけ更新し、配布ごとの発行は不要。具体的な運用ID・期限・credential metadataは公開文書へ複製しない。

テンプレートをreview後、別承認で既存manual workflowへ適用しmainへ取り込む。そのmainとartifactの一致確認、Environment保護詳細、既存readonly endpointの読取可否、token policy pin、本人Dashboard対応/既知正常artifactを確認してから手動dispatchする。dispatch時の `owner_recovery_ready` は本人による実確認であり、監視成功や回復成功を生成する値ではない。

## 検証

metadata診断・controller停止/単発実行・provider/HTTP mock・process credential隔離・artifact公開範囲・manual-only templateをofflineで検証する。metadata診断はsecret名の存在だけでは `credentialValidity=UNVERIFIED`、`deployAllowed=false` を維持する。今回実providerのtoken有効性・権限・配信成功は未確認。
