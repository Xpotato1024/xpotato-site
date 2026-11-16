---
status: proposed
owner: content
last_verified: 2026-11-16
canonical_for:
  - model-independent content execution responsibility and recovery
---

# AIが制作を依頼先まで届ける実行手順

記事は japanese-technical-blog、ツールは create-browser-tool から始める。本書は担当者向けの共通実行規約であり、第三の利用者入口ではない。
文章・図の良し悪しは[編集方針](../content/editorial-policy.md)と[初稿品質ゲート](../../.agents/skills/japanese-technical-blog/references/first-draft-quality-gate.md)、工程は[一貫制作](content-production.md)、CLIは[編集入口](content-workflows.md)が所有する。
本書は実行責任の共通参照先を定める変更案であり、Article Jobの状態・schema・承認・配備権限や[設計lifecycle](../architecture/design-status.md)を変更しない。

## 担当者が終了点を持つ

Coordinatorは依頼の解釈、依存関係、割当、統合、検証、配布先への反映、後片付け、終了報告を一貫して担当する。
人間は題材と目的を伝える。内部Skill選択、worker管理、既知情報の再入力を人間の仕事へ戻さない。
開始時に対象ID/URL、入力revision、変更範囲、対象外、認可済み終了点を既存記録へ短く固定する。
例えば「記事を差し替え、既存の本人限定Siteも更新」は、同じSiteで新しい版を読めることまでを含む。
計画、素材生成、ローカルbuild、委譲、進捗返信だけではその依頼は終わらない。
一回限りの依頼は現在の実行で認可済み終了点まで進める。「後で自律的に続ける」という約束で代替しない。
取消・範囲変更時は終了点を更新し、未実施事項を完了へ読み替えない。

## 能力と権限を先に確かめる

依存する前に、次の必要分を実際のtool一覧・設定・小さなreadonly確認で調べる。存在と実行成功は別に記録する。

| 必要な能力 | 確認する事実 |
|---|---|
| source取得・render | 読める入力revision、形式、利用権、描画adapterと出力の取得方法 |
| CAD・図・screenshot | 制作/起動/撮影adapter、保存先、実画面を観測できるか |
| browser・操作QA | 接続対象、専用context、実操作/画像確認/終了の方法 |
| private配布 | 既存target、audience、save/deploy/status/readbackの能力と操作権限 |
| 並列実行 | worker、独立した出力先、共有資源の制限、終了確認の方法 |

利用できるadapterと許可範囲から経路を選び、特定のmodel名、agent数、OS path、CLI vendor、context/token予算を前提にしない。
同じ検証可能な成果物を作れる認可済み互換手段へ切替えられる。並列能力がなければ逐次実行でよい。
「アプリがある」「providerが使える」は起動・撮影・送信・公開の許可ではない。既存認可の根拠を操作ごとに照合する。
外部AI入力は[開示契約](../contracts/external-ai-disclosure-contract.md)のexact bytes/manifest条件を守り、委譲でも境界を広げない。
必要な本人判断だけを分離する。禁止・拒否された範囲は別prompt、sandbox解除、proxy、別adapter経由で迂回しない。

## 小さなcheckpointから復旧する

既存Job/PR/sessionの作業記録を再利用し、別の必須schemaや第二の状態機械を作らない。次の必要分を観測事実として追記する。

- 対象ID/URLとaudience、source/inputのrevision、出力pathと必要なhash/version。
- 工程の状態、担当/出力所有者、実行結果・検証範囲と証拠への参照。
- 次の具体的な操作、未解決の依存、失敗分類と結果不明の副作用。

予定・推測は事実と区別する。secret、資格情報、hidden reasoning、不要な全文logは記録しない。
再開時はメモだけを信用せず、現ファイル・hash・Job状態・必要なremote版を読み直し、成功済み工程と最初の未完了工程を回収する。
入力変更で失効する下流だけを再検証する。成功済みの保存・配備を盲目的に再実行せず、結果不明ならreadonly照合を先に行う。
詳細な証拠再利用と失敗分類は[開発workflow](development-workflow.md)に従う。

## 独立した依存だけを並列にする

Coordinatorは短いDAGを作り、各nodeに入力、出力、先行条件、確認方法を置く。実装済みJobのstage順序を上書きしない。
固定sourceを使う構成案・根拠整理・visualの必要性の検討と、環境preflight・独立したdocs作業は、入出力が独立なら同時に進められる。
visualの事前検討は正式stage完了ではない。正式stageの依存は[Article Job契約](../contracts/article-job-contract.md)を守る。
最終合成は実素材の到着・確認を待つ。最終renderは合成固定後、配備はその候補の検証済みbuild確定後に行う。
予定path、source候補、workerの「完了」メッセージを依存解決として扱わない。

割当時は既存taskメモに次の契約を短く渡す。新しい記入票の提出を求めない。

| 割当要素 | 渡す内容 |
|---|---|
| scope | 目的、変更対象/対象外、許可操作、停止条件 |
| input snapshot | exact revision/hash、必要source、決定済み事項 |
| ownership | 唯一のwriter、所有output path、共通temporary root内の作業範囲 |
| deliverable/check | 実物の形式・受入条件・検証方法、返すpath/hash/結果 |
| handoff | 待つ依存、統合担当、失敗・不足・残件の通知先 |

mutableな成果物にはwriterを一人だけ割り当てる。同じbranch操作、lockfile、asset、共有ファイルへの同時書込みを許さない。
workerは分離した所有出力を返し、Coordinatorだけが共有候補へ統合する。他者変更を戻さない。
共有UI/browser、同一targetへの配備、rate limitのある操作は直列化する。独立contextの並列可否は実adapterで確認する。
Coordinatorはworker稼働中も独立作業を進め、受渡し・期限・失敗等のmilestoneで確認する。短周期pollingを続けない。
workerの終了だけで受理せず、実出力とcheckを照合する。無出力/失敗なら依存を未解決へ戻し、修正・再割当または逐次回収する。
無制限の再委譲・入れ子agentを作らない。終了/失敗workerを回収して閉じ、子jobを放置しない。

## 部分成功・拒否・中断を扱う

成功出力を保持し、失敗を実装、環境/依存、権限、通信/tool、証拠不足へ分類する。
retryは分類済みtransient、または原因を修正した失敗だけ。回数・待機・期限は操作の性質で有限に決め、model別の定数にしない。
timeoutした書込みは失敗確定ではなく結果不明である。target/version/statusを照合し、成功済みなら再送しない。
アプリ起動拒否は実screenshotを作る許可を生まない。合法かつ認可済みの別sourceを探せるが、概念図は概念図と表示し、実UIの証拠にしない。
必須証拠が得られなければ該当主張/工程を未検証として残す。拒否を伏せたり推測でPASSを作ったりしない。
取消時は新規副作用を止め、所有子job/browserを終了し、保持すべき成果物と再開点を残す。
中断後はcheckpointと現物から再開する。独立して可能な作業を終えた上で、残る実blockerと必要な本人判断を具体的に報告する。

## 検証の種類を混ぜない

各gateは対象revision/hash、範囲、方法、結果、証拠を結ぶ。未実行・部分成功・別候補のgreenをPASSへ合成しない。

| gate | 必要な証拠と限界 |
|---|---|
| 入力/素材 | source proposalではなく実bytes、形式・hash・権利・来歴と必要な実読込 |
| 内容 | 主張・根拠・読者の問い・文章の整合。schema/static checkだけで意味品質を認定しない |
| 独立review | 規定stageの別contextによる内容/図版監査。著者self-checkを独立PASSと呼ばない |
| 完成画面 | 同じ候補の実renderを画像/操作で確認。overflowゼロや画像保存だけで可読性PASSにしない |
| 実例/UI | 実観測と概念図を区別。parse成功を実行済みと呼ばず、実UI確認を生成画像で代用しない |
| build/配布 | 同じ入力・合成・artifactの検証と配布先readback。localとremoteの成功を分ける |

viewport/文字拡大/操作の具体条件は[完成ページQA](content-production.md#完成ページqaと本人限定preview)を参照し、数値matrixを複製しない。
合成scenarioは静的な参照/回帰検査であり、semantic品質、独立review、service実動の証拠ではない。

## 共有previewを反映して読み返す

既存target更新では同じID/URLとaudienceを維持する。新Siteを複製して済ませず、private許可をproductionへ延長しない。
配布用の版確定と、Gitのcommit/mergeは別操作として、それぞれ既存の許可を確認する。
既存adapterのsave→deploy→terminal status→readbackを確かめる。saveだけ、accepted/runningだけでは配備済みと呼ばない。
対象ID、terminal結果、version/hashと実URLの対応、role/accessとnoindex、実本文・素材・リンクを同じ候補で照合する。
adapterがhashを返さないならversionと取得bytes等の利用可能な証拠を結び、取得不能項目は未確認として残す。
配備timeout時は現在のremote版と状態を読み、完了を確認できたらその証拠を採用する。未確定なら結果不明として重複配備しない。
local成功はremote更新の代替にならない。配備能力/権限不足でも準備を完了し、要求終了点は未達と報告する。
正規保存/export、本番artifactと配信は[制作手順](content-production.md#正規保存と配備準備)、[build契約](build-artifact-pipeline.md)、[配信境界](deployment-boundary.md)に従う。

## 終了を判定する

完了には、依頼された終了点への到達、同じ候補の成果物と検証、配布先の確認、子jobの回収、所有一時物のcleanupがそろう必要がある。
残る本人判断、実blocker、未検証、対象外を区別し、ID/URL、revision/version、成果物、検査結果、次に必要な操作を短く伝える。
chat更新は作業完了ではない。未達なら部分成功と未達の終了点を示し、無人の子jobや将来の実行約束を残して閉じない。
動作保証性は、責務・依存・証拠・権限を実装側でも検査し、失敗を検知・復旧できることで高める。文書の遵守や静的testだけで正常動作を保証したと扱わない。service可用性や読者品質の数学的保証ではない。
本書の静的回帰検査: `npm test -- packages/article-pipeline/src/ai-content-execution.test.ts`。実配布・編集評価は別に行う。
