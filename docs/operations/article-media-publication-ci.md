# 記事mediaの公開CI（初回設定・実運用は未受入れ）

設計は[ADR-0063](../design/adr/0063-reusable-r2-publication-ci.md)。Siteに保存処理を集約し、Xpotato-Serverの一時operatorは不要。画像保存先はR2、ページ配信は既存Workers Static Assetsのまま。現在のコード/合成試験の成功は実保存や公開の成功ではない。

## 初回だけ必要な設定（まだ実行しない）

| 対象 | 具体的設定 | 状態 |
|---|---|---|
| R2 token | A `xpotato-site-prod-source` / B `xpotato-assets` / C `xpotato-site-prod-protected` だけのObject Read & Write、再利用1組 | 未発行。Admin/設定/token管理権限なし |
| Environment Secrets | `site-production`: `R2_MEDIA_ACCESS_KEY_ID`, `R2_MEDIA_SECRET_ACCESS_KEY` | 未登録。既存deploy Secretとは別 |
| Environment/Repository Variable | `R2_MEDIA_CONFIG_JSON`: account ID、3bucket、public origin、本人が初回確認した設定のrevision/確認時刻 | 未設定。秘密値なし |
| 起動スイッチ | `MEDIA_PUBLICATION_ENABLED=true` | 未設定/無効のまま。実受入れ前に有効化しない |
| 設定確認 | A/C非公開、Bの既存domain、expiryなし、C `site-protected-all-v1` enabled/空prefix/Indefinite | 初回・変更時・異常時に確認。毎記事全inventory不要 |

configの型は `r2PublicationConfigSchema` が正本。`acceptance.basis=owner-reviewed-configuration-v1` は本人設定確認であり自動実観測ではない。receiptもこのbasisを明示する。架空のlive policy/失効receiptは作らない。

有効化前にmain保護、Environmentのmain限定、本人reviewer、admin bypassなし、SecretsのEnvironment限定、第三者PRへのsecret不渡しを実設定で確認する。ソースのworkflow guardは確認したが、今回のbranch protection APIは403 `Resource not accessible by integration`、Environment API wrapperは非対応だった。別credential等で回避しておらず、現在のlive設定は未確認。履歴文書の2026-10-06受入れを最新観測とは扱わない。必要なのは既存設定の確認とこの2Secret/2Variableの追加であり、新しい広いAPI tokenは要求しない。

## 毎記事の操作

1. 正式Jobの内容/画像監査・権利・根拠・保存許可を通す。`node --import tsx scripts/media-publication.ts prepare --job <job-id> --output .local/publication.json` を実行する。出力は公開可能な内容だけだが、公開前ファイルとして扱う。私有Job全体はアップロードしない。
2. 同時に出る `publication.json.admission.json` は、正式prepareが実監査/全bytesを検証した公開safeなproducer記録。通常PRでmainの `config/article-publication-admissions/<ContentId>.json` へ採用する。本文や画像の変更なら再prepare/対応監査が必要。日付だけではbundleを再生成しない。CIはmainの実Git blobと完全package SHA/semantic SHA/実監査来歴を取得時・保存前にexact照合し、任意packageのdispatchだけでは保存しない。これは新しい監査PASSの自己申告ではない。
3. 本人アカウントで同repoのdraft releaseへ `application/json` のassetをアップロードし、release ID/asset ID/ファイルSHA-256を控える。draftのまま保持し公開しない。これは未実施。後で実操作の対象と権限を確認する。
4. `Article media publication (manual)` をmainの完全SHAで起動し、packageのID/hashとmode `publish` を指定する。owner/main/manual/run attempt1/Environment/有効化Variableを全て要求する。PR/pushで起動せず、package取得・検査の後の1stepだけR2 Secretを受け取る。`GITHUB_TOKEN`はcontents readだけ。
5. artifactの `publication-result.json`、`changes.patch`、`files/` を取得し、選択したsemantic hashと実保存receipt、A/B/C件数を確認する。canonical差分の通常PR・CIを通し、mainのProduction artifactを既存手順で配信する。保存だけで公開完了としない。

新規記事の繰返し公開に鍵の再発行/入力/失効は不要。既存記事更新は初版では拒否する。鍵の期限・rotation方針は初回設定時に本人が選び、毎記事作成へ戻さない。

## 失敗・中断

SDK `maxAttempts:1`、全PUT `If-None-Match:*`。未知の結果、403、意味不明404、bytes/metadata違いは停止。上書き修復や同じrunの再実行は禁止（attempt2をguardで拒否）。`progress.json`/`failure.json` に最後のplane/keyと固定エラーだけを残し、SDK生error/header/署名URLを記録しない。

新しい手動runの `verify-only` はGETだけで既存A/B/Cを照合する。欠落があればexportしない。未知PUTの成否が判明してから次の必要操作を判断する。成功した既存objectは再PUTせずGET一致でreuseする。失敗・中断時のpartial保存は公開記事へ昇格しない。古いobjectの自動削除は行わない。

生成ファイルの公開日はexport時JST。配信日が変わればmetadataだけ実公開日へ更新し通常検査する。本文/画像/根拠不変の日跨ぎでAI監査を再実行しない。private Job cleanupは耐久Git/根拠/recoveryが検証されるまで行わない。
