---
status: canonical
owner: content
last_verified: 2026-11-18
---
# 固定ページ・ツール等の現在の編集来歴

本文の唯一の表示源はcontentのMDXです。編集来歴の正本は `content/registry/editorial/provenance.json`、型は `editorialProvenanceRegistrySchema`。現在のpath、ContentId、本文/parsed frontmatterのSHA-256、route、出典・主張の来歴を結び付けます。元のPublication Provenanceを失わず、過去の編集順序はGit履歴へ残します。

現在のsourceとhashを直接検証します。旧Phase 4/5の53件を再生成してbefore/after差分を求めることや、廃止overlay専用の互換pathを保持することはありません。改稿時は同じContentIdと公開URLを維持し、必要な現行来歴だけを更新します。権利・taxonomy・media/Demo参照等の契約は別途通常validatorが検証します。

対象はpages/projects/tools/notes。Blogは既存のArticle Job・本人承認・公開契約を通します。このRegistryは記事公開、画像のA/B/C保存、provider activationを許可しません。AIによる実質的な加筆を本人原稿へ偽装したり、根拠・承認を推測で補いません。
