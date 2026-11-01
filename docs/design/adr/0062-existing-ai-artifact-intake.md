---
status: proposed
owner: architecture
date: 2026-11-01
---

# ADR-0062: 既成AI原稿・画像の取込みと新規AI実行を区別する

## 問題と確認済みの境界

完成済みのAI原稿・生成heroを再制作せず初公開へ進めたい。一方、現在の手書きdraft入口はproducerがhuman固定、review scopeはhuman_localまたはsynthetic_fixtureであり、既成AI成果物をそのまま入れると来歴を偽る。過去の生成履歴は、新しいArticle JobのSemanticRequest・disclosure admission・成功receiptではない。

## 提案する最小経路

既成入力をhash固定のprivate intakeとして保存する。本文・hero・図・根拠・権利・観測済み生成／採用履歴のbytesを保持し、AI originには別のlineage artifact参照を必須とする。モデル名や完全promptを不明なのに生成せず、過去の実行を新しいprovider実行として再構成しない。歴史情報のbytes照合は、その記載の真偽や画像権利の合格とは区別する。

`stageExistingArticleInput`／`readExistingArticleInput`はこの入力保全までの実装である。取込元はrepositoryの`.local/existing-article-sources/`以下だけに限定し、`.aws`・`.ssh`・`.codex`・`.env*`等の資格情報pathとlinkを拒否する。全入力のhash・sizeと既知のsecret／capability形式を検査してから、`.local/article-jobs/existing-inputs/`へimmutableに保存し、再読取でも検査する。再実行で別bytesへ上書きしない。外部通信・provider利用料・storage uploadは発生しない。これはmock保存receiptでも正式stage receiptでもなく、Article Job・human approval・rights admission・production eligibilityを付与しない。

## 正式Jobへの接続で必要な選択

推奨は**既成AI成果物の独立scopeを設ける方式**。上記の入力hashを正式Jobの入力へ結び、既存の根拠検証・独立内容／visual audit・候補生成・実際の本人承認・A/B/C実保存とcompact provenanceへ接続する。新規AI実行は不要だが、authorをhumanへ変換したり、AI auditをhuman auditとして登録したりしない。現在のhuman専用schema・署名／receipt・publication guardを単に緩める変更は行わない。

比較対象は、新規の正式semantic author実行を行う方式。固定Skill・request・disclosureとrunner lineageを新たに得られる一方、既成稿を再生成し、有料provider接続等の別認可も必要になる。今回の完成稿を早く公開する目的には採らない。

公開準備の継続依頼に従い、専用の`existing_ai` scopeを実装する。実行権限・開示admission・実runnerの接続を、scopeの追加だけで成立したとは扱わない。live writer/session/exportの未接続も別の残条件で、intakeによって解消したとは扱わない。Cloudflare sessionやprovider設定の実観測・操作結果はprivate運用記録で別に扱い、コードのreceiptと混同しない。

## CREATED Jobへの接続

`article existing-input init --content-id <UUID> --input-sha256 <intake hash> --reader-outcome <目的>`は保存済み入力だけを読み、同じContentIdの正式`CREATED` Jobを作る。入力のbase commitとrepositoryが一致し、ID／route／出力名が衝突しないことを検査する。Job specはintake manifestの実bytes hashを入力に持ち、全原本と来歴の再照合を行う。作業稿はfrontmatterの`draft: true`化と正規化だけを行い、元MDXのbytesを保持する。公開日を確定したことにはならない。

attemptのproducerは`existing_ai`であり、`received-draft.json`を使用する。`human-draft.json`、SemanticResponse、独立監査、本人承認、保存receiptを生成しない。network／provider／media保存／exportの権限は全てfalse。`--local-media-processing`だけは明示的に選べる上限とする。入力が変われば新intakeが必要で、human Jobへのcloneやhuman importによる改稿は拒否する。

## 根拠・監査request・候補への専用接続

新しいJobの`existing-ai-review-v1`は2つの独立監査Skillのbytesをbaseへ固定し、specの入力hashへ含める。古いprofileなしのJobを自動昇格しない。Source bundleはintake／元稿の両hashを必須とし、human Jobとscopeを相互変換しない。既存のSource/Evidence/Claim検査・receipt state machineを使い、元の数値引用を変換する場合は原文上の位置とSource ID集合を固定して通常の引用compilerへ渡す。元MDXやmaterial claimの原文spanを上書きしない。

内容／visual auditのrequestは正確なSkill hashを含む。監査の判断responseと、executorが観測する実行metadataは別のschemaである。`contextRef`や`freshContext`、結果hashを自分で計算したJSONは実行証拠ではないため、現行importは`AGENT_AUDIT_TRUSTED_EXECUTION_REQUIRED`で拒否する。未実行の合成observationが`CONTENT_READY`や承認候補へ進まないことを試験する。

`prepareExistingAuditInvocation`は既存SemanticRequest／exact-set disclosure compilerを再利用し、同じJob・attempt・本文hash、実際の監査target bytes、固定Skillと参照資料、固定response schema、fresh context上限を照合する。権限false、deny／stale input、余分な入力、違うSkill／schemaは実行前に拒否する。この前処理はproviderを起動せず、fixture成功を正式stage receiptにしない。既存ChatGPT loginの存在や利用料の有無だけでも開示許可にはならない。

visual／candidateのscope型は専用scopeを保持し、全監査scopeの一致と既存の候補・日付・保存計画の検査を維持する。本人承認は引き続きhuman専用である。実runnerからの固定request・actual task／response・disclosure manifest・journalの検証と正式importが成立するまでは、監査経由の候補生成は有効化しない。live保存・公開済み扱いにしない。
