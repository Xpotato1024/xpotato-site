---
status: proposed
owner: operations
last_verified: 2026-09-28
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
- `legacy-migration`: old content/media/redirect disposition

material architecture changeはcanonical doc + ADRを同期する。

## Design before migration

1. design review/acceptance
2. baseline inventory/measurement
3. legacy tag freeze
4. workspace + GitHub Actions skeleton
5. site/content/search foundation
6. content/taxonomy migration
7. source/public/protected media migration
8. route/SEO/search parity
9. Cloudflare desired-state cutover preparation
10. old implementation removal
11. Article Job/example/media tooling implementation
12. visual redesign

旧stack上で全面redesignしてから同componentを再migrationする順序を避ける。

## Workspace ownership

- `apps/site`: static site + MiniSearch build/client adapter
- `packages/content-contracts`: shared schema
- `packages/article-pipeline`: Article Job
- `packages/media-ingest`: canonical media + variants
- `packages/example-verifier`: bounded code/config verification
- `packages/site-validators`: deterministic gates

## PR scope

workspace skeleton、site foundation、content migration、media migration、old removal、Article Job、redesignを可能な限り分離する。

Cloudflare resource implementation/applyをsite frontend PRへ混ぜない。

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

各変更に必要なunit/regression/contract/static/build検証と変更経路のtargeted smokeはその場で行う。security、data safety、hardware safetyの受入条件も統合E2Eまで先送りしない。全面的な実操作E2Eや全pipelineの統合確認はrelease前の受入段階へ集約し、変更に有効なcomponent証拠は再利用する。統合された実物でしか確認できない接続、順序、復旧はそこで確認する。前倒しや再実行には横断変更、統合回帰、証拠失効、明示した受入条件などの根拠を残す。全面E2E未実施のcomponent完了をrelease-readyやruntime検証済みと呼ばない。

### Skill連鎖と停止条件

最も狭い適用Skillを選び、関連Skillを無条件に連鎖実行しない。Skillはこのworkflowを引き継ぎ、古い担当指定、全件再検証、常時全面監査、毎回の報告書を追加条件にしない。productのAI model profileは開発担当の設定と別のcontractである。Skill変更で関連するevalやprovenanceが失効する場合はその範囲を検証し、無関係なSkillの再認証・promotion・基盤新設を要求しない。

受入条件、影響範囲の検証、必須review、文書同期が満たされ、material blockerがなければ完了する。新しい根拠のない再監査・再検証を追加しない。任意改善は既存backlogへ分け、完了記録は既存PR/task stateへ集約する。
