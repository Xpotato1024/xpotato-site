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

## 完成ページでの確認

単体図だけでなく、本文との対応と実表示幅での文字・矢印・凡例を確認する。ページや対応図を確認できない場合は未検証範囲として残す。横はみ出しゼロや素材の存在を可読性の証拠にしない。図に移した説明が画像欠落で失われていないか、構造アイコンを説明図の代わりにしていないかを確認する。
