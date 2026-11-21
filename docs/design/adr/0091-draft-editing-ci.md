---
status: proposed
owner: operations
last_verified: 2026-11-21
---

# ADR-0091: 下書き編集と公開・コードCIの分離

## 背景

記事の更新・添削はPRを経由する。公開repositoryのrunner利用量よりも、編集を確認できるまでの実時間が問題になる。並列化で全体CIを短くしても、原稿の保存ごとにコード・公開処理・browser機能matrix・Windows成果物検査を待つ構造は残る。

CMSはportableな `draft:true` 原稿と派生したeditor content indexを同時に更新する。公開済みの記事や公開exportは、公開URL、検索・一覧、媒体と来歴、実行可能なregistry indexへ影響する。両者を単一の「記事だけの変更」にまとめない。

## 判断候補

変更pathとexact Git identityで候補を絞った後、既存のparser/schema/AST validatorで未公開原稿であることを確かめる。旧新ともdraft、または新規draft、安定したContentId、対象原稿と一致するindexだけを下書きCIへ送る。意味判定不能・公開状態変更・共有入力は全体CIへ戻す。

下書きCIは全repositoryの整合性、全site build、公開生成物、performance budget、route/link/search等を検証する。公開UIの内容を変えないため固定機能matrixとrelease/Windows経路を毎保存から外す。Astroはdraftもcompileするのでbuild/出力検査は残す。正規Astroレビューは従来どおり独立して動く。

コードPR・公開変更・mainは全体CIを保持する。mainの原稿・コード変更は下書きも全体検証を行い（既存prose-only例外を除く）、追加の週次成功を公開前検査の代用にしない。PR label `ci:full` により全体経路へ戻せる。検査失敗を成功に変換せず、候補jobの成功と意味判定falseだけを通常fallbackとして扱う。

全体CIで同じ短いcommandを合成CMS編集に対して実行する独立jobを持つ。コードPRでは通常のarticle jobが対象外になるため、この回帰を同run/attemptのpackage gateへ含める。合成原稿の結果を実際の記事PRの性能値として報告しない。

## 代案

- **pathだけで全記事を短縮:** 公開切替やruntime MDX、CMS索引の無関係な変更を区別できないため採用しない。
- **scopeで依存を入れてから判定:** 内容検証は可能だが下書きjobでも同じ依存を入れ直す。候補job内で判定と検査を続けることで二重installの待ちを避ける。
- **以前の全体CI結果やdistを再利用:** 成功の同一性・依存の証明とartifactの公開資格を複雑化する。今回不要であり、前回PASSを現commitへ転記しない。
- **公開記事のbrowserだけ先に省く:** 本文がホーム更新欄・検索・関連記事・font/layoutへ波及するので、今回の下書き条件より広い証明が必要。公開記事の次段階では静的全体検査と実ページ統合検査を残し、変更のない実装matrixから分離する。

## 採用・検証

実装候補の規則と実行graphは[下書きCI](../../operations/ci-change-impact.md)が所有する。実Gitの有効なCMS編集、旧新公開状態、index/ID/AST改変、fallback・resultの異常状態、隔離worktreeでの実pipelineを確認し、独立レビューと同headのHosted CIで記録する。mainへの取り込みと本番配信は別操作である。
