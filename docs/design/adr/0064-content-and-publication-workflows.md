---
status: proposed
owner: development
date: 2026-11-02
---

# ADR-0064: 編集入口と公開計画の統一

本人は初回記事公開で局所修正が連続したことを受け、簡潔さ・運用労力・費用・必要十分な安全性を優先する全体整理を依頼した。既存Astro/GitHub Actions/Wrangler/R2を保ち、サービスや鍵は増やさない。本PRはソースとDraft PRまでで、本番適用の承認ではない。

## 問題

記事にはprivate Job、ツールには生成/導入CLIがあるが、通常編集の案内は移行・監査文書に分散していた。固定ページの下書き生成とSEO/更新のrepo skillが不足し、記事の初期本文もコード内の文字列だったため、再利用できるMarkdownテンプレートへ切り出す。workspace境界は有効で、一括移動を行う根拠はない。

公開側は、正規media projection、CSP、固定7route中心のreadback計画が別経路だった。通常CIは実packageで配信計画を実行せず、初めて本番で組合せの不足が見つかった。さらに配備1回が成功しても直後のbytes不一致だけで全体failureとなり、失敗対象・receipt・postimageを失っていた。

## 方針

1. `templates/content/`と既存CLIを編集入口にし、4経路を一つの運用ガイドへまとめる。AI記事のcanonical直接書込みは追加しない。
2. build後の`_publication.json`を唯一の新公開projectionにする。source SHA、検証済みmedia、全HTML route、discovery、必要assets、CSPを含むheaders、有限検査計画を固定artifactで包む。自己hashは持たない。
3. media権利・保護来歴からprojectionを作り、同じ生成入口でCSPを作る。public originの定数を一箇所へ集める。`ci:final`とpackage組立後で実物を再計算し、配信と同じcompilerへ通す。Candidate計画検査とProduction認可は分離する。
4. 配備状態`not_attempted / attempted_unknown / acknowledged`と確認状態`not_started / pending / verified / failed`を分ける。receiptを配備直後に保存する。確認だけの失敗からdeployを自動再実行しない。
5. 200/404のbytes/header不一致は同一version確認の下でGETだけ再観測する。最大3観測、全体120秒、1要求10秒、最大325GET/42MiB。redirect、過大body、未知origin、version drift、代替endpoint公開は成功へ丸めない。記録はmanifest由来path、status、bytes、hash、時刻・回数のみで本文/生API応答/秘密は残さない。

## 有限予算の根拠

providerの既存64 GET上限は変更しない。配備前後の完全snapshotを維持し、再観測中は同じ既存deployments endpointの100%稼働versionを1 GETで確認する。3回観測で成功する最長通常経路も42 provider GETで収まる。再観測ごとに全inventoryを12 GETずつ取り直す重複は追加しない。

旧実distを入力とする初期測定は27route、126検査（うち正規外部画像32）、10,626,028 bytes。新記事・一覧・分類・tag・RSS・sitemap・search indexを含む。上限160対象/16MiBとし、最大計画の初回＋一度の全対象再観測＋before3/after2で325GET。3回目は残余予算内の不一致だけ。実bodyは各2MiB（固定Prime bundleのみ6MB）、総42MiBで停止する。無制限に増やさず、将来超過は通常CIで検出し対象と費用を再評価する。

## 段階と互換

変更単位は公開計画/診断と、編集テンプレート/スキル。既存URL、本文、画像、分類、来歴、非公開分離は変更しない。旧artifactのrollbackに限り旧media projection読み取りを残し、新buildには新manifestを必須とする。移行履歴やvendorの大量移動は行わない。

本番の新しい配備・確認方式の受入れは別途必要。既存の失敗runを成功へ改変せず、過去の不一致原因を証跡なしに伝播遅延と断定しない。新コードの合成試験成功と実運用成功を区別する。
