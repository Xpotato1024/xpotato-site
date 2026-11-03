---
status: proposed
owner: development
last_verified: 2026-11-03
---

# 0065: 使用中の作業コードを責務で配置する

PR140の公開契約統一を基点とする追加の開発変更。採用・配信は別判断であり、現行本番へ適用済みとは扱わない。

## 問題と判断

root scriptsには定常CLI、build integration、QA、過去の比較実験が混在する。さらにsite-validatorsが下書き生成と導入更新の書込みも所有しており、「検査を読む」つもりでwriterへ到達する。名前だけを一括変更せず、npm/workflow/import/描画来歴から利用が確認できた範囲を選ぶ。

新しいworkspace/serviceは作らず、`tools/authoring`、`tools/build`、`tools/qa`、`tools/publication`へ作業コードを配置する。npm名・引数・出力先は維持する。配信/復旧/監視コードとCI分類は既存`scripts/release`等に残す。選別の根拠と保留理由は[tools所有表](../../../tools/README.md)を参照。

page/tool generatorとinstaller writerをvalidatorsから外す。導入configuration/schema、同じgenerated projection、identity/rights/pin/lockの読取り検査はvalidatorsの一実装を再利用する。writerはその検査を呼び、複製しない。synthetic builderはtests/fixturesへ移し、実sourceレビューとの境界を明確にする。共有header parserはportable-contentへ置き、検証と配信の二系統化を避ける。

toolsは通常の型検査/Vitest/CI対象。private candidateのbuild fingerprintはauthoring/build/publicationも追跡し、移動によって鮮度検知を落とさない。QAを新しい本番能力として認可しない。

## 保持する境界

URL、ContentId、本文/画像、Registry、vendor、公開asset、権利来歴、保存/承認の状態遷移は変更しない。生成された配信正本、hash固定の導入物、使い捨てdist、private Jobは別物として維持する。

root旧実装は現行build/deploy先ではない。fixed-Git inventoryとhome画像取得は確認できたが、legacy cutover/rollbackおよび旧画像削除の受入れは未閉鎖なので削除しない。archive/old-srcのコピーも作らない。古いvendorも、immutable pinと旧版検証/復旧の利用があるため一括削除しない。

## 移行と検証

新しいtoolsのパスへimport、相対repository root、workflow/npm、CI graph、候補/fixture生成を同時に更新し、旧script forwardingを残さない。過去のhash固定証跡は書き換えない。旧運用記録はhistoryへ移し、旧リンクには現行案内を残す。

作成/導入のplan/apply/rollback、draft隔離、candidate freshness、型検査、build、artifact結合検査、CSS/公開route/asset/metadataの不変性を検証する。配置変更の影響と無関係なソースcommit表示差は区別する。実provider操作や配信は行わない。
