---
name: independent-visual-audit
description: Article Jobのvisual candidateをdraftとVisualPlanに対してfresh vision contextで独立監査する。画像生成、planning、approvalには使わない。
---

# Independent Visual Audit

## Inputs

- audit-clean article draft
- target VisualPlan
- candidate image
- relevant fixed evidence if factual visual

visual candidateが0件ならexecutorがempty audit manifestをdeterministic生成し、このSkillを呼ぶ必要はない。

## Check

- topic relevance
- misleading factual appearance
- fake UI / terminal / code / graph / metric
- accidental / garbled text
- crop / safe area
- visual artifact / quality
- publication safety
- factual visualのsource/evidence binding

## Rules

- generator自己評価をaudit代替にしない
- conceptual visualをtechnical evidenceとして評価しない
- material issueを装飾だからと無視しない
- required Blog hero不足はpassにしない
- human approvalを生成しない

## Output

VisualAudit response schemaに従いpass / revision_required / blocked + findingsを返す。
