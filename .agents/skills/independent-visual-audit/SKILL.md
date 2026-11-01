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
- `limitations`は未充足の必須検査・根拠不足だけを記載する。必須のページ画像や図の確認ができなければ未解決として残し、passにしない。
- 実機モバイル・本番配信・人間の公開承認は、この固定画像監査の実施範囲へ自動追加しない。本文が実機や本番の検証済みを主張していない限り、それらを実行しなかったという範囲の注記だけを`limitations`へ入れない。reference画像は公開承認や実機検証を付与しない。
- 必須検査が全て完了して未解決事項がなければ`limitations: []`を返す。`pass`と未解決事項の併記は正式取込みで拒否される。既知の未解決事項を空配列で隠さない。

## Output

VisualAudit response schemaに従いpass / revision_required / blocked + findingsを返す。

## 完成ページでの確認

単体図だけでなく、本文との対応と実表示幅での文字・矢印・凡例を確認する。ページや対応図を確認できない場合は未検証範囲として残す。横はみ出しゼロや素材の存在を可読性の証拠にしない。図に移した説明が画像欠落で失われていないか、構造アイコンを説明図の代わりにしていないかを確認する。

## 具体性と図の説明力

`.agents/skills/japanese-technical-blog/references/concrete-visual-editorial.md`を適用する。主要説明の具体物・設定・観察、常体の問い見出し、補足の必要性と配置、対象とラベルが追える図を確認する。固定の例数・図数で合否を判定しない。重大な条件を削ったり、公式ロゴ/実UI/実測を生成で補ったりしない。

## 読者範囲と図の実表示

`.agents/skills/japanese-technical-blog/references/audience-and-visual-scale.md`を併用する。一般向けの入口を特定製品の手順へすり替えず、症状別の判断順序を記事全体でそろえる。図中ラベルは本文との比率をPC・スマホの実表示で確認する。
