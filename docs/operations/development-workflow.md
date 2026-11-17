---
status: proposed
owner: operations
last_verified: 2026-11-18
canonical_for:
  - development workflow
---

# Development Workflow

## Branching

`main`へ直接commit/pushしない。feature branch + PR + CIを通す。

## Change classes

- `content-only`: MDX/editorial/taxonomy refs only, no new media bytes
- `media`: canonical source/variant/profile/registry/publication flow
- `frontend`: component/style/interaction
- `search-discovery`: tokenizer/index/UI/archive/RSS/related
- `architecture`: framework/routing/runtime/schema/dependency
- `operations`: CI/build/deployment/Cloudflare control-plane contract
- `article-pipeline`: AI/evidence/audit/example/media orchestration
- `content-compatibility`: existing content identity / redirects / publication holds

material architecture changeはcanonical doc + ADRを同期する。

## 現行機能を基準にした変更手順

1. 記事制作・読者向け機能の目的、変更範囲、維持する契約を固定する。
2. 現在のmainと対象source/artifactを確認し、影響する所有者へ変更を置く。
3. 最小の実装と対象の回帰検証を行う。廃止したCLIや古いPhaseを再導入しない。
4. 共有契約・呼出元・文書を同期し、不要になったコードとテストを同時に撤去する。
5. 公開URL・本文・権利・公開hold・認可・成果物の同一性を現在のRegistryから確認する。
6. feature PRの同一commitに対するCIと必要な実操作検証を完了する。
7. merge、外部サービスの接続、本番配信は、それぞれの認可と状態を区別する。

過去の移行工程や廃止実装の再現は、[固定Git履歴](source-history.md)から独立して行う。日常の編集・build・CIの前提にはしない。

## Workspace ownership

- `content/`: MDX・分類・媒体・公開来歴・URL履歴・公開holdの正本
- `apps/site`: 静的サイトとサイト固有の表示・操作
- `apps/editor` / `apps/editor-api`: 編集PWAと所有者限定のGit・Draft R2 API
- `packages/content-contracts` / `portable-content`: 共有schemaとコンテンツの純粋処理
- `packages/design-system`: サイト・CMS・図表が共用するデザイン値
- `packages/editor-core`: 下書き・ブランチ競合・媒体容量・保持期限
- `packages/article-pipeline`: Article Jobと公開来歴
- `packages/media-ingest`: 正規化・画像変換・配信用variant
- `packages/example-verifier`: 分離した実行例検証
- `packages/site-validators`: 現在のsource・Registry・配信成果物の検査
- `ops/`: 制作・build・QA・CI・媒体保存・配信の実行入口

## PR scope

利用者の目的と責務の単位で分ける。単なる移動、旧コード撤去、新機能、記事更新を無関係に混ぜない。現在の機能の安全性を確認するテストは維持するが、廃止済み方式をテストするために旧実装を残さない。

Cloudflare resource実装・適用をsite frontend PRへ混ぜない。ファイル移動の互換stubは呼出元の移行完了時に撤去し、履歴の復元はGitへ任せる。

## Article Job generated changes

Article Job export=feature branch working tree/patchまで。

PRへ追跡可能にする:

- candidate hash
- human approval
- content/visual audit result
- source/evidence summary location
- canonical source/public/protection receipt hashes where media exists
- validation result

private source/prompt/full job workspaceをPR本文へ貼らない。

## Media changes

new raster mediaはGitへ追加しない。

Article/media PRでは:

- semantic asset ID
- canonical source hash/profile
- delivery profile/variant manifest
- rights/provenance
- source-storage/publication/protection receipt chain

をreview対象にする。

raw camera/AI provider originalをPR artifactへ添付することをdefaultにしない。

## Search changes

MiniSearch/tokenizer/profile変更時:

- Japanese/mixed regression fixture
- serialized index bytes
- `/search/` JS bytes
- representative result quality

をreviewする。

content migrationとtokenizer tuningを無関係に混ぜない。

## Cloudflare changes

normal site deployはGitHub Actions + Wrangler。

DNS/R2/Rules/resource changeは`Xpotato-Server`側change。

R2 config adminをsite PR/CIへ追加しない。

Dashboard manual settingをPR completion conditionにしない。

## Review evidence

change classに応じて:

- affected routes/collections
- validation result
- representative viewport
- JS/search-index/media transfer impact
- accessibility manual smoke
- architecture/ADR impact
- migration inventory impact
- external storage/provider receipt/drift evidence

を提示する。

## Generated files

hand-editしない:

- generated JSON Schema
- search index
- responsive media variants
- social card derivative
- generated redirects/build inventories

source/profile/generatorを修正する。

## Legacy access

legacy sourceはfrozen tagを明示refとして読む。

active implementation探索へlegacy refを混ぜない。

## 再実行を増やさない実装・検証運用

### 担当とmodel設定

通常実装は一人の担当が調査、実装、変更に必要な検証、失敗の修正、文書同期、引継ぎまで一貫して行う。モデル選択は上位指示、ユーザー設定、実効設定に従い、repository文書から固定model IDや強制切替を要求しない。重要な設計判断やrisk上必要な独立reviewは別担当がread-onlyで行い、実装者の結論を正解として引き継がない。必須review条件を下げず、自己検証で十分な変更に形式的なreviewを追加しない。

### 検証結果の再利用

再実行前に既存の証拠を確認する。同一、または対象propertyへ影響する差分がないと説明できる場合は結果を再利用する。

- 検証対象source/artifact、関連diff、仕様・受入条件、検証範囲
- command/options、validator/test、toolchain、依存lock、設定、入力/fixture
- 結果に影響するOS/runtime/environment、外部状態、権限、期限・鮮度

Git revisionと関連diff、既存artifact identityを優先し、再利用のためだけの全file hash manifestや証拠DBは作らない。無関係な文書変更、担当交代、context切替、mainの無関係な前進だけで検証全体を失効させない。影響する条件が変わった場合はその条件と依存範囲だけを再検証する。影響範囲を限定できない場合は理由を示して広げる。

結果には対象revision、範囲と条件、command、結果、証拠の所在、再利用理由、未完了範囲と再開点を必要十分に記録する。`PASS (reused)`は以前の実行への参照であり、新規実行ではない。`FAIL`、`BLOCKED_ENV`、`INCOMPLETE`、`Not Run`、理由付き`NOT_APPLICABLE`を区別し、未確認・未実行・出力切れをPASSにしない。current PR headで必須のCI/reviewは古い結果を貼り替えて充足しない。証拠の再利用は権限を追加しない。

### 不完全reviewと環境エラーからの復旧

review記録には対象、確認済み範囲、未確認範囲、finding、証拠を残す。形式不備、出力切れ、参照不足があっても確認済みの根拠を破棄せず、元記録を保持して不足箇所を補う。独立判断の不足は独立reviewerが補う。実装担当がfindingを黙って消したり、未確認範囲を埋めて独立PASSを作ったりしない。元reviewerの独立性と必要なcontextが保てる場合は補足を依頼し、それ以外は不足範囲のみ別reviewerへ渡す。product contractがfresh contextや固定requestを要求する場合はその条件を守る。

失敗は実装、環境/依存、権限、通信/tool、検証出力に分類する。成功済みstepを保持し、最初の未完了step、原因、行った修正、次に確認する対象を記録する。環境修復後は小さなpreflightで原因の解消を確認し、失敗stepと影響する下流だけを行う。無変更のまま同じretryを繰り返したり、権限不足を設定緩和で回避したりしない。mutation結果が不明な場合は状態とidentityを確かめてから再開し、非冪等操作をblind retryしない。

### 変更単位の検証と統合E2E

Windowsでも固定Node/npmから `npm test` を実行する。file symlink作成権限がない場合は、その専用caseだけ理由付きSKIPとし、lock・改竄・hardlink・directory junctionの拒否検査は継続する。SKIPは安全性のPASSではない。Linux producerではfile symlink検査を必須とし、作成失敗もFAILにする。端末の権限やDeveloper Modeを検査のために変更しない。

preview CLIの終了検査は、POSIXではSIGTERM、Windowsでは検査用子プロセスのIPCから同じ終了handlerを呼び出し、未完了TCP接続があっても正常終了することを確認する。Windowsの強制終了をgraceful shutdownと扱わない。Gitの改行設定は一時fixture内だけで固定する。合成tool用worktreeの後片付けは、作成した一時directoryのidentityを確認し、限定回数の再試行とそのworktreeだけの登録解除を行う。後片付け失敗で元のbuild/validator失敗を置き換えない。

各変更に必要なunit/regression/contract/static/build検証と変更経路のtargeted smokeはその場で行う。security、data safety、hardware safetyの受入条件も統合E2Eまで先送りしない。全面的な実操作E2Eや全pipelineの統合確認はrelease前の受入段階へ集約し、変更に有効なcomponent証拠は再利用する。統合された実物でしか確認できない接続、順序、復旧はそこで確認する。前倒しや再実行には横断変更、統合回帰、証拠失効、明示した受入条件などの根拠を残す。全面E2E未実施のcomponent完了をrelease-readyやruntime検証済みと呼ばない。

### Skill連鎖と停止条件

最も狭い適用Skillを選び、関連Skillを無条件に連鎖実行しない。Skillはこのworkflowを引き継ぎ、古い担当指定、全件再検証、常時全面監査、毎回の報告書を追加条件にしない。productのAI model profileは開発担当の設定と別のcontractである。Skill変更で関連するevalやprovenanceが失効する場合はその範囲を検証し、無関係なSkillの再認証・promotion・基盤新設を要求しない。

受入条件、影響範囲の検証、必須review、文書同期が満たされ、material blockerがなければ完了する。新しい根拠のない再監査・再検証を追加しない。任意改善は既存backlogへ分け、完了記録は既存PR/task stateへ集約する。
