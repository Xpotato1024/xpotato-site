# 既成AI稿の独立監査

対象はADR-0062の`existing_ai` Jobだけ。原稿の再生成、人間監査への変換、保存・公開の権限付与は行わない。

## 入口

既存のChatGPTログインを使用する独立監査を本人が依頼した場合のみ、`article existing-input init`の`--existing-login-audit`を明示する。このflagは監査用network/text AIと名前付きinputの上限だけであり、実bytesを送信するgrantではない。固定したJobで`audit inventory`を作り、Job・attempt・intake・本文・監査target・全artifact ID/SHA/size集合・stage・OpenAIの既存ChatGPT/Codexという宛先への明示承認を、executorが別のimmutable stage-grantへ正規化する。grantをJob specへ入れないためhashは循環しない。同じintakeでも別のprivate sourceや要件を足すとinventoryが変わり、旧grantは失効する。公開依頼や一般的な監査依頼だけでgrantを生成しない。grantなしでは実requestの生成・実行・replayが拒否される。既存Jobの権限や過去のdeny記録は書き換えない。画像生成・source/public/protected保存・exportは許可しない。

```text
article existing-input init --content-id <UUID> --input-sha256 <hash> --reader-outcome <目的> --local-media-processing --existing-login-audit
article audit inventory --job <job-id> --stage content
article audit admit --job <job-id> --stage content --from <private-exact-disclosure-grant.json>
article audit run --job <job-id> --stage content --from <private-transport-profile.json>
article audit run --job <job-id> --stage visual --from <private-transport-profile.json>
```

transport profileはoperatorが確認した既存のnative Codex executableのpath/SHA、native Nodeのpath、`model: gpt-6.1-sol`、`transport: existing-chatgpt-codex-cli-v1`を指定する。認証情報は含めない。API key lookup、login、新規credential、任意adapter、model fallbackは実装しない。

実行profileは`existing-ai-independent-codex-v1`。既存Codex CLIのChatGPT認証を強制し、high effort、新規ephemeral context、空の作業directory、固定schema、read-only sandboxを使う。shell/apps/browser/plugins/memory/追加agent/画像生成等の任意機能を無効化する。managed rules・approval・mandatory hooksを無視するflagは使わない。モデルによるtool activity、追加turn、複数final message、失敗・部分応答は受理しない。これらの実効性は実CLIによる受入と区別し、flagsの静的確認だけを運用成功と呼ばない。

## 正式取込み

固定Skillと参照文書をJobのbaseへ保存する。現在のJob要件・本文・UTF-16位置表・source/evidence/analysis・監査target・response schema、visualではplan/mastersと全target画像の実bytesを、保存済みJobから組み立てる。必須集合からの欠落・別bytes・余分な入力を拒否する。各入力のexact disclosureを再検査し、秘密値は明示許可があっても送信しない。

モデルは判断だけを返す。実行側がCLIイベントの新規thread、終了状態、実入力・schema・応答のhashと時刻を記録する。独立抽出の空配列でmaterial claimsの監査passを作らない。本文span・evidence ID・limitations・最終応答の宣言byte上限を検査する。

immutableなprocess記録・応答と`RuntimeOperationJournal`のverified結果を再照合してから、メモリ内のproofを発行する。単独のJSON、自己申告のobservation、fixture receiptではproofを作れない。内容／visual journalの初回importと再読込みがこの証拠を要求する。信頼するローカルexecutorとprivate filesystemを基点とする記録であり、暗号学的なprovider証明ではない。

子CLIのdeadlineは外側journalより10秒短い。外側取消はbridgeをkillせずcancel fileを渡し、bridgeが所有するCLI handleを停止して終了を待つ。停止を確認できない場合は`containmentFailed`とPIDを記録し、結果不明として停止する。遠隔providerの取消完了を推測しない。同attempt/stage/inputのpending/unknown検査はjournal lock内でも行い、新しいrequest IDによる再送を拒否する。

CLI互換性は実binaryでも確認する。現binaryのimage tool禁止は`features.view_image=false`で、未対応の重複`tools.view_image`指定は使わない。strict config、read-only、managed rules/approval/hooksと任意tool activity拒否は維持する。

既知のローカル設定parser停止だけは、正式executable SHA、元plan context、固定Job/target/全入力と現在grant、immutable process入力・終了記録・stdout/stderr hashを再照合する。exit 1・停止/containment失敗なし・5秒以内の終了・stdout空・`tools.view_image`のunknown-fieldという完全一致diagnosticを全て満たす時だけ、別private predispatch観測を残せる。元unknown/resultは書き換えず、監査passやprovider receiptにはしない。この具体的な送信前停止が証明できた場合だけ次の新しい監査要求を許す。pending、部分turn、network/auth error、timeout、記録欠損・改変では拒否を維持する。空stdoutだけから未送信と推定しない。

監査のsafe compact lineageは候補のprovenance proposalへ含める。private prompt・source本文・process path・認証情報は公開しない。本文監査、visual監査、正確な候補への本人承認、A/B/C実保存と読戻し、正式exportはそれぞれ別工程である。

## 受領した生成表紙と説明図

生成表紙は`ai_generated`を維持する。`existing_ai` Jobのheroだけで許可し、元のhero bytesと、同じimmutable intakeにある生成・採用lineageのSHAを照合する。新しい生成実行や完全promptを捏造しない。権利recordは`ai_generated_authorized`を要求する。

説明図は装飾へ偽装しない。非装飾diagramには固定evidence/claimへの正確な参照と、その命題に一致するrequired factsを要求する。SVGはactive content・外部／local参照を拒否してからローカルでcanonical rasterへ変換する。visual監査の前にpublic variantを生成しない。

## 実保存の境界

このtransportはCloudflare認証を扱わない。既存のWorkers用tokenやDashboardログインをR2 signing parentへ変換しない。固定Server契約に沿ったoperator signer/session factoryと、その明示的な権限・有限寿命・保持／失効手順が別途必要である。
