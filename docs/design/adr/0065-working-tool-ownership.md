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

page/tool generatorとinstaller writerをvalidatorsから外す。導入configuration/schema、同じgenerated projection、identity/rights/pin/lockの読取り検査はvalidatorsの一実装を再利用する。writerはその検査を呼び、複製しない。synthetic builderはtests/fixturesへ移し、実sourceレビューとの境界を明確にする。共有header parserはサイト固有の配信規則を持つためsite-validatorsへ置き、検証と配信の二系統化を避ける。

toolsは通常の型検査/Vitest/CI対象。private candidateのbuild fingerprintはauthoring/build/publicationも追跡し、移動によって鮮度検知を落とさない。QAを新しい本番能力として認可しない。

## 保持する境界

URL、ContentId、本文/画像、Registry、vendor、公開asset、権利来歴、保存/承認の状態遷移は変更しない。生成された配信正本、hash固定の導入物、使い捨てdist、private Jobは別物として維持する。

root旧実装は現行build/deploy先ではない。fixed-Git inventoryとhome画像取得は確認でき、root旧source/configは凍結commitとbytes一致。ただしPhase10は旧src/設定の撤去にもcutover/rollback条件を要求し、旧rasterにはprotected restore条件が別途ある。これらの完了証跡は未成立なので削除しない。具体的な解除条件は[現在の配置](../../operations/repository-ownership.md)。archive/old-srcのコピーも作らない。

古いvendorは全7pinの通常実bytes照合と旧版回帰の実入力で、採用契約も旧bytes保持を要求する。active-only検査へ緩めて削除せず、現行選択1版と履歴6版の責務・除去時の固定Git復元契約をvendor/READMEに明記する。別subrootへの配置だけでは削減効果がなくresolverが増えるので採用しない。

追加整理では、移行CLIと8つのcanonical writerをtools/migrationへ、再現比較をtools/reviewへ、素材生成をtools/assetsへ移す。builders/read-only checksは共有し、Phase5のmanual revision上書き拒否は維持。Phase6 local encoding/診断は書込みを持つためIO orchestration全体をmigrationへ移す。release package writerもbuildへ。旧WordPress importer・status-only curl2本・CSP単独writerを廃止し、CSP検査をpublication compilerへ一本化する。旧scriptを多数のforwarderとして残さない。固定描画来歴7本だけはsource fingerprintがpathを固定するため既存scriptsに残し、日常入口にはしない。

## 移行と検証

新しいtoolsのパスへimport、相対repository root、workflow/npm、CI graph、候補/fixture生成を同時に更新し、旧script forwardingを残さない。過去のhash固定証跡は書き換えない。旧運用記録はhistoryへ移し、旧リンクには現行案内を残す。

作成/導入のplan/apply/rollback、draft隔離、candidate freshness、型検査、build、artifact結合検査、CSS/公開route/asset/metadataの不変性を検証する。配置変更の影響と無関係なソースcommit表示差は区別する。実provider操作や配信は行わない。

## 再現可能コピーの撤去契約の再設計

上の当初保持判断のうち、text/configのcutover連動と全履歴vendorのworking-tree常置は[ADR-0066](0066-reproducible-repository-copy-retirement.md)で改訂する。実media保護・公開hold・本番移行の受入れは維持し、同bytes Git復元・全pin検査・明示復元後のselectを要求する。本人が撤去表の613 trackedファイルを明示承認した後、固定Gitとpreimageを再照合してPR141作業ブランチから撤去済み。Draftのmain採用・本番反映を完了したとは扱わない。
