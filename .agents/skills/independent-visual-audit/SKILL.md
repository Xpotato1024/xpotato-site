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
- 図中の文字・矢印・凡例が対象読者とモバイル幅で判読できるか
- caption・alt・本文との対応があり、図の解釈が不必要な脳内補完を要求しないか
- 観測写真・決定的SVG・生成した概念画像を意味上区別できるか
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
