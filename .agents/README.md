# Repository-local Skills

## 通常制作の入口は2つ

- `japanese-technical-blog`: 記事の目的・読者から本文/実素材、共通構造、分類・SEO、本人限定preview、正規保存と配備準備まで進行を担当する。
- `create-browser-tool`: ツールの利用目的からcore/UI/adapter、掲載ページ、固定版取込み、分類・SEO、実表示と配備準備まで担当する。

[一貫制作手順](../docs/operations/content-production.md)と[共通ページ構成](../docs/content/page-composition.md)を共有する。利用者に内部Skillの選択を求めない。必要な専門処理だけ呼び、無条件の全件連鎖実行はしない。

## Article Job内部のsemantic stages

`discover-article-sources` / `analyze-article-evidence` / `draft-japanese-technical-article` / `independent-article-audit` / `revise-article-from-audit` / `plan-article-visual` / `independent-visual-audit`

production requestはexact Skill/reference snapshotとresponse schemaを固定する。入口の一貫した進行管理と、author/auditorの独立contextは別。担当が同じという理由で独立監査PASSやhuman approvalを自己発行しない。

## 必要な工程だけで使う支援

- `site-content-publish`: 共通部品・Registry・一覧/分類/タグ・本人限定review・正規exportへの統合。
- `site-seo-review`: SEO入力と同じ候補の実HTML/SNS/discoveryを照合。
- `update-site`: 既存記事/tool/固定ページ/styleの正本と変更範囲を選ぶ。記事/toolの制作自体は上の入口へ戻す。

共通値・型・CLIをSkillへ複製しない。数式/構成図/グラフは[技術ビジュアル](../docs/operations/technical-visuals.md)、実回路/CAD/GIFは[工学素材](../docs/operations/engineering-visuals.md)。新しい公開経路・資格情報・承認帳票を追加しない。

## Lifecycleと検証

Skillはsource pinning、実行結果、canonical write、state transition、human approval、R2保存/保護、merge/deployのauthorityではない。既存のdeterministic executorと認可された外部操作を使う。

入力・禁止操作・response contract・positive/negative routing・参照整合を検査する。構造testのPASSは意味評価や実読者品質の証明ではない。固定stageの参照更新は将来のsnapshotに反映し、過去のJobを無言で書き換えない。

詳細は[Skill governance](../docs/operations/agent-skill-governance.md)。実装担当、証拠再利用、未完了工程からの復旧はroot `AGENTS.md`と[development workflow](../docs/operations/development-workflow.md)を参照する。
