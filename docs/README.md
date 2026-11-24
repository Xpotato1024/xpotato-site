---
status: canonical
owner: architecture
last_verified: 2026-11-18
---
# Xpotato documentation

現在のコードを扱う入口は以下です。旧サイト移行のPhaseを再実行することは、通常の編集・build・公開の前提ではありません。旧コードや当時の手順は[固定Git履歴](operations/source-history.md)から参照します。

| 目的 | 正本・入口 |
|---|---|
| 利用者の目的 | [Product context](product/product-context.md) |
| 現在の採用・実環境状態 | [Design status](architecture/design-status.md) |
| ディレクトリ・依存 | [Repository layout](architecture/repository-layout.md) / [ops](../ops/README.md) |
| 通常の記事・メモ・固定ページ・ツール制作 | [Content workflows](operations/content-workflows.md) / [一貫制作](operations/content-production.md) |
| CMSのロゴ・アイコン | [Editor brand assets](operations/editor-brand-assets.md) |
| GitHub・Draft R2の初回接続 | [Editor connection](operations/editor-connection.md) |
| CMSと人間→AIの引継ぎ | [Editor workflow](operations/editor-workflow.md) / [実装状態](architecture/cms-implementation-status.md) |
| コンテンツ・部品・媒体の契約 | [Contracts](contracts/README.md) / packages/content-contracts |
| 共通デザイン | [Design policy](architecture/design-system-policy.md) / packages/design-system |
| 図表・実行例 | [Technical visuals](operations/technical-visuals.md) / [工程用素材](operations/engineering-visuals.md) |
| 画像の正式保存 | [Media publication](operations/article-media-publication-ci.md) |
| コードの分離・コメント・整形 | [Code style](operations/code-style.md) |
| 開発・CI | [Development](operations/development-workflow.md) / [CI](../ops/ci/README.md) |
| artifact・本番配信 | [Build artifacts](operations/build-artifact-pipeline.md) / [Deployment boundary](operations/deployment-boundary.md) |
| 実際の本番配信状態 | [Deployment status](operations/current-deployment-status.md) |
| provider・Cloudflare権限 | [Infrastructure handoff](architecture/infrastructure-handoff.md) |
| 情報の取扱い・外部AI | [Security/privacy](architecture/security-privacy-policy.md) / [Disclosure contract](contracts/external-ai-disclosure-contract.md) |
| 監査 | [Audit](governance/audit.md) / [Severity](governance/severity.md) |
| 設計判断の理由 | design/adr/（現行値や実稼働の第二正本ではない） |

設計・実装・合成試験・実環境接続・本番公開は別の状態です。mainへのmergeやCI成功を、GitHub App/R2の設定完了や記事公開の承認として扱いません。

必要な領域の契約と操作手順を読み、実際のコードと検証結果を確認して作業します。過去の受入れ記録は、その対象commitと当時の範囲の証拠です。
