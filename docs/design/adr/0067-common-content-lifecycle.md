---
status: proposed
owner: development
date: 2026-11-03
---

# 記事とツールの新規・更新を同じ経路へ揃える

PR141の未採用差分。利用者が全ツール・全記事に共通の経路を要求したため、初記事限定の保存とPrime専用の移行・更新・本文hash whitelistを現役経路から外す。公開・権利・根拠の審査、R2-first、C保護、通常PRと手動配信は維持する。新しいサービスや鍵は追加しない。

記事は同じJob→監査→prepare→trusted-main admission→保存→canonical patchを使う。新規v1 packageの意味hashと既存admissionは不変。更新だけにkindと前版のGit commit、MDX/media/rights/provenanceのraw SHA、compact recovery hashを追加し、意味hashに結合する。保存前に現在mainの前版とindex所有を照合する。ID・file・URL・pubDateは変えず、本文更新のupdatedDateをJSTで付ける。移転・削除は既存redirect設計が必要な別操作。旧objectは残し、exactな逆差分を復旧PRの資料として出力する。

ツールはsource/artifact/review/pin→installer plan/apply/checkを使う。新規だけ配置と下書きMDXを生成する。更新は現在のartifact hashを固定し、配置・本文・公開状態を保つ。公開は全tool共通のexact pin admissionであり、bounded profileの独立runtime review、Worker/WASM exact-setと有限予算を省略しない。紹介文・SEO・分類・日付はMDXが唯一の編集正本。登録側はID・slug・hydration・host表示/ライセンスpolicyだけを所有する。

共通wrapperはtoolIdから安定名を導出する。CSSはURL資産として対象routeだけが読み込む。CSPは登録された各manifestのWorker/WASM能力から有限のroute別directiveを導出し、syncへ不要なWorker/WASM権限を付けない。フォントも各module markerと固定manifestのUI sourceから選び、Primeだけを特別に扱わない。AGPL対応ソースofferの実体と追加license原文を検証し、法的表示はmanifest/登録policyから生成する。PrimeのID比較で権限や表示を決めない。旧async profileと旧composed Workerはimmutableな旧artifactの検証・復旧だけに限定し、新candidateへ転用しない。ADR0061の閉じた候補一覧は歴史記録となり、通常の本文更新は共通MDX/編集台帳/PR reviewで扱う。

検索用の合成記事は`tests/fixtures/search/`へ移す。`blog`は内部collectionの安定したschema識別子として維持し、公開経路は`/articles/<不変ID>/`に統一する。内部名だけの全面renameは、Job・schema・移行記録を無益に変更するため採用しない。

検証は、異なる同期型/Worker型ツールが同じ新規・公開済み更新入口を通ること、別IDの記事の新規・更新、前版/権利/画像/承認の不一致で保存前停止、未知結果でexportなし、失敗時の既知bytes復元と未知編集保全、旧6版のGit復旧、既存Prime/公開記事の実build比較を要求する。合成receiptは実保存の証明ではない。今回の開発ではprovider書込み・merge・本番配信を行わない。
