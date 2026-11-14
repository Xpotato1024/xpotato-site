---
status: proposed
owner: architecture
date: 2026-11-14
---

# ADR-0076: 公開記事の付与タグをすべてリンクする

## 背景

Pythonは凍結済みPhase5 registryの `archive:false` を継承し、記事で非リンク表示になり、一覧routeも生成されていなかった。一方、一覧画面の「7タグ」に対する6件表示は別のpreview上限によるものであり、同じ原因として扱わない。

## 決定候補

- 現行editorial facadeでactiveタグのarchiveを有効化する。元のPhase5 payload、stable ID、slug、検索掲載の `indexable` は保持する。
- 公開・indexableなBlog記事が使うタグに限り一覧を生成する。目的タグも同じ方針とし、未使用・draft・noindex・held記事だけの空一覧は増やさない。
- 公開記事の付与タグに生成先と記事収録がなければbuildを失敗させる。生成後のHTMLでもタグリンク先の実ファイル欠落を検出する。
- 非公開プレビューは公開一覧へのリンクを作らない。

## 影響

既存URLを変えずPython等の欠けていた一覧が追加される。検索掲載を許可していないタグは一覧があってもnoindexを維持する。既存公開タグの削除・無効化は、記事の割当を同時に解消しなければ検査エラーになる。本変更は本番デプロイや公開境界の解除を認可しない。
