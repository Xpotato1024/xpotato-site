---
name: independent-visual-audit
description: Article Jobのhero/visual candidateを記事draftとVisualPlanに対してfresh vision contextで独立監査するときに使う。画像生成、visual planning、approvalには使わない。
---

# Independent Visual Audit

## Inputs

- audit-clean article draft
- VisualPlan
- candidate image
- relevant fixed evidence if factual visual

## Check

- topic relevance
- misleading factual appearance
- fake UI / terminal / code / graph / metric
- accidental / garbled text
- unintended brand / logo implication
- crop / safe area
- visual artifact / quality
- publication safety

## Rules

- generatorの自己評価をaudit代替にしない。
- conceptual heroをtechnical evidenceとして評価しない。
- factual visualはsource/evidence bindingを確認する。
- material issueを「装飾だから」で無視しない。
- human approvalを生成しない。

## Output

VisualAudit response schemaに従いpass / revision_required / blockedとfindingsを返す。
