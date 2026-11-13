# 記事mediaの公開CI

設計は[ADR-0063](../design/adr/0063-reusable-r2-publication-ci.md)。Siteに保存処理を集約し、Xpotato-Serverの一時operatorは不要。画像保存先はR2、ページ配信は既存Workers Static Assetsのまま。初回設定と実保存は完了し、最初の記事は公開済み。実保存は [run 41371394358](https://github.com/Xpotato1024/xpotato-site/actions/runs/41371394358)、記事入り配備は [run 41461513406](https://github.com/Xpotato1024/xpotato-site/actions/runs/41461513406) を参照。後者は配備後の即時照合で失敗し、後続の取得は一致したが、その失敗原因は未確定。合成試験の成功や後続一致で旧runを成功に書き換えない。

## 初回設定（登録済み、通常は再作成しない）

| 対象 | 具体的設定 | 状態 |
|---|---|---|
| R2 token | A `xpotato-site-prod-source` / B `xpotato-assets` / C `xpotato-site-prod-protected` だけのObject Read & Write、再利用1組 | 登録済み。Admin/設定/token管理権限なし |
| Environment Secrets | `site-production`: `R2_MEDIA_ACCESS_KEY_ID`, `R2_MEDIA_SECRET_ACCESS_KEY` | 登録済み。既存deploy Secretとは別 |
| Environment/Repository Variable | `R2_MEDIA_CONFIG_JSON`: account ID、3bucket、public origin、本人が初回確認した設定のrevision/確認時刻 | 登録済み。秘密値なし |
| 起動スイッチ | `MEDIA_PUBLICATION_ENABLED=true` | 有効化済み。未設定/無効なら保存前停止 |
| 設定確認 | A/C非公開、Bの既存domain、expiryなし、C `site-protected-all-v1` enabled/空prefix/Indefinite | 初回・変更時・異常時に確認。毎記事全inventory不要 |

configの型は `r2PublicationConfigSchema` が正本。`acceptance.basis=owner-reviewed-configuration-v1` は本人設定確認であり自動実観測ではない。receiptもこのbasisを明示する。架空のlive policy/失効receiptは作らない。

初回設定時にGitHub正規UIでmainとEnvironmentの保護を確認し、2Secret/2Variableを登録した。以後、変更時にはmain限定・本人reviewer・bypass・Secrets範囲を確認する。このdirectory整理では設定を再観測・変更していない。以前のAPI読取り403/非対応という履歴は、初回UI確認後の状態を表すものではない。新しいtokenや設定変更をこの文書の存在から許可しない。

## 毎記事の操作

1. 正式Jobの内容/画像監査・権利・根拠・保存許可を通す。`node --import tsx tools/publication/media-publication.ts prepare --job <job-id> --output .local/publication.json` を実行する。出力は公開可能な内容だけだが、公開前ファイルとして扱う。私有Job全体はアップロードしない。
2. 同時に出る `publication.json.admission.json` は、正式prepareが実監査/全bytesを検証した公開safeなproducer記録。通常PRでmainの `config/article-publication-admissions/<ContentId>.json` へ採用する。本文や画像の変更なら再prepare/対応監査が必要。日付だけではbundleを再生成しない。CIはmainの実Git blobと完全package SHA/semantic SHA/実監査来歴を取得時・保存前にexact照合し、任意packageのdispatchだけでは保存しない。これは新しい監査PASSの自己申告ではない。
3. 本人アカウントで同repoのdraft releaseへ `application/json` のassetをアップロードし、release ID/asset ID/ファイルSHA-256を控える。draftのまま保持し公開しない。初回の記事では実施済み。次の記事・更新でも同じ固定asset経路を使い、既存assetを暗黙上書きしない。
4. `Article media publication (manual)` をmainの完全SHAで起動し、packageのID/hashとmode `publish` を指定する。owner/main/manual/run attempt1/Environment/有効化Variableを全て要求する。PR/pushで起動せず、package取得・検査の後の1stepだけR2 Secretを受け取る。workflow既定は`contents: read`を維持し、この保護された手動保存jobだけ`contents: write`を付与する。Draft Release取得のためだが、job実行中は対象repositoryのcontents書込み能力を持つ。PR CIや他jobへ広げず、常設tokenは追加しない。checkoutの資格情報保持は無効、実装するGitHub操作は固定release/assetのGETのみ。
5. 更新のartifactには前版commit/hashと `rollback.patch` も含む。これは復旧PRの資料であり自動適用しない。現在のpostimage一致と `git apply --check` を確認して通常PRで戻す。旧source/公開/保護objectは削除しない。
6. artifactの `publication-result.json`、`changes.patch`、`files/` を取得し、選択したsemantic hashと実保存receipt、A/B/C件数を確認する。canonical差分の通常PR・CIを通し、mainのProduction artifactを既存手順で配信する。保存だけで公開完了としない。

新規記事の繰返し公開に鍵の再発行/入力/失効は不要。新規・更新は同じprepare/publish/verify-only経路を使う。更新は正式Jobの `--content-id` と `--update-kind` で開始し、MDX/media/rights/provenanceの正確な前版bytesとGit祖先commitをpackage/admissionに結合する。保存前にcurrent mainの全preimage・index所有を照合し、競合は保存せず停止する。鍵の期限・rotation方針は初回設定時に本人が選び、毎記事作成へ戻さない。

## 失敗・中断

SDK `maxAttempts:1`、全PUT `If-None-Match:*`。未知の結果、403、意味不明404、bytes/metadata違いは停止。上書き修復や同じrunの再実行は禁止（attempt2をguardで拒否）。`progress.json`/`failure.json` に最後のplane/keyと固定エラーだけを残し、SDK生error/header/署名URLを記録しない。

新しい手動runの `verify-only` はGETだけで既存A/B/Cを照合する。欠落があればexportしない。未知PUTの成否が判明してから次の必要操作を判断する。成功した既存objectは再PUTせずGET一致でreuseする。失敗・中断時のpartial保存は公開記事へ昇格しない。古いobjectの自動削除は行わない。

新規の公開日はexport時JST、初回updatedDateは省略する。A/B/Cの保存と最終bytes照合が全て成功した直後にexport時刻を一度だけ取得し、MDXの日付・publicationDay・完了記録・provenanceを同じ時刻から生成する。保存前の日付逆行検査は維持し、export時にも再検査する。objectごとの保存・確認時刻は実際の各観測時刻のまま残す。更新はContentId・file・URL・pubDateを維持し、本文更新のupdatedDateは同じexport時刻のJST。metadata_only/media_onlyでは既存の日付を維持する。更新による移転・削除はこの経路では扱わず、別のredirect設計が必要。新規の配信日が変わればmetadataだけ実公開日へ更新し通常検査する。本文/画像/根拠不変の日跨ぎでAI監査を再実行しない。private Job cleanupは耐久Git/根拠/recoveryが検証されるまで行わない。
# Environment variable timing

`MEDIA_PUBLICATION_ENABLED` is an Environment variable. It is checked in the first runner step, after the protected Environment is admitted, and passed explicitly to acquisition and publication. Do not move it into `jobs.publication.if`: [GitHub documents that Environment variables are only available after a job starts](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#configuration-variable-precedence).

## 本人確認済み既成AI稿の実装候補

[ADR-0074の専用経路](owner-reviewed-existing-ai-publication.md)は、AI監査hashの代わりに明示的なowner-review evidenceを持つ別producerです。通常のprepareは変更しません。確認元の実会話とexact原稿・画像の対応が不明なら停止し、PASSや架空のAI runは作りません。main admission・owner/manual/Environment・A/B/C照合・preimage・通常CIとdeployの境界は共通です。この候補の存在は実記事への承認や本番採用を意味しません。
