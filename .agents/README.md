# Repository-local Skills

このdirectoryは`xpotato-site`固有のsemantic workflowを保持する。

## Article Job stage Skills

- `analyze-article-evidence`
- `draft-japanese-technical-article`
- `independent-article-audit`
- `revise-article-from-audit`
- `plan-article-visual`
- `independent-visual-audit`

production Article Jobでは、deterministic requestが使用Skillのsnapshotを固定する。

Skillはcanonical workspace write、state transition、human approvalを所有しない。

## Manual support Skills

- `japanese-technical-blog`
- `site-content-publish`

これらはconversational/manual support用であり、Article Job production stageのexact contractを迂回しない。

## Lifecycle

implementation時にstage Skillごとのpositive / negative routing、required input、forbidden action、response contractをevalする。

validated Skillだけproduction Article Jobへbindする。

詳細は`docs/operations/agent-skill-governance.md`。
