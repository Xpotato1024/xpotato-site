---
status: canonical
owner: architecture
last_verified: 2026-11-18
canonical_for:
  - 連載と学習コースの所属・順序
  - 公開連載目次と前後ナビゲーションの導出
---

# 連載・学習コース

連載は、関連記事の類似度や公開日とは独立した読む順序を持つ。教育資料、技術記事、メモ、固定ページ、制作物、ツールを同じ仕組みで参照できる。記事本文への前後リンクの追記は不要。

## 正本

- 編集データ: `content/registry/series/series.json`
- 機械契約: `packages/content-contracts/src/series.ts`
- 参照検査・公開用の導出: `packages/portable-content/src/series.ts`
- 公開表示: `apps/site/src/features/series/`、`apps/site/src/pages/series/`

registryは`schemaVersion: 1`と`series`配列を持つ。各連載は以下を設定する。

| フィールド | 意味 |
|---|---|
| `id` | 連載の安定ID。小文字英数とハイフン。変更せず使い続ける。 |
| `slug` | `/series/<slug>/`の公開パス。registry内で一意。 |
| `title` / `description` | 目次に表示する名前と説明。 |
| `kind` | `series`（連載）、`course`（学習コース）。 |
| `status` | `ongoing`（連載中）、`completed`（完結）、`paused`（休止中）。 |
| `entries` | `{ contentId, label? }`の順序付き配列。`contentId`はUUIDv4。`label`は目次や前後移動用の任意の短い見出し。 |

同じ記事を複数の連載に含められる。一つの連載内での重複は禁止する。連載ID・slugの重複も禁止する。未作成のContentId参照は保存時の検査・repository検証・buildで失敗させ、単に一覧から消さない。

記事のfrontmatterに連載所属、番号、前後URLを重複保存しない。順序変更は一つのregistry変更で完了し、後から追加した古いメモも任意の位置に置ける。カテゴリ・分野・目的タグは読む順序を決めない。

## 公開への変換

公開目次にはcatalogの`published`かつ`webIndexable`な項目だけを含める。下書き、hold中、noindexの記事は、タイトル、任意見出し、ID、URL、件数のいずれも公開連載データへ転送しない。番号は残った公開項目だけに1から付け直す。非公開項目を挟む前後移動は、次の公開済み項目へ直接進む。

公開対象が0件なら連載固有ページを生成しない。`/series/`自体は空状態を表示するがnoindexとし、sitemapにも含めない。公開対象1件なら第1回として表示し、存在しない前後リンクを出さない。末尾の案内は連載の状態に従う。

一番後ろの公開記事は、連載の`status`が`completed`なら「最終回」、`ongoing`または`paused`なら「現在の最新回」と表示する。次の記事がないことだけで完結とは推測しない。連載中・完結・休止の状態も表示する。未公開の予定回数は表示しない。

リンク先はそのbuildのcatalogからContentIdで解決する。ファイル名やタイトル、メモのslugが変わっても連載内の参照は変えない。連載slug自体を変更する場合の旧URL転送は、サイト共通のredirect管理に従う。

## サイトの表示

全5collectionの共通`ContentLayout`で、冒頭に連載名・現在の番号、末尾に前の回・次の回・全体目次を表示する。複数の連載に所属するときは連載ごとに別の案内を出す。固定commitのprivate Astro reviewには公開連載の所属表示を追加しない。CMS即時プレビューでは、非公開の編集状態から下書き込みの登録順を別に表示し、公開用projectionと区別する。

`/series/`は公開連載一覧、`/series/<slug>/`はその読む順序の目次。`/series/`以下は固定ページとの衝突を禁止する。本文ページへReact islandや専用JavaScriptを追加せず、静的リンクで移動する。

`/education/`には、公開記事・メモの`education.subject`ごとの資料と、公開済み`kind: course`の目次を導出する。対象読者、前提、学べることは教育メタデータから表示する。連載所属と教育分野はそれぞれ独立して編集できる。

## 初期状態と検証

初期registryは空。既存記事の関連性を推測して自動的に連載へ割り当てない。実データへの所属追加は編集者が行う。

純粋関数の試験で、順序変更、日付との独立、重複・不正ID・存在しない参照、非公開項目の除外、URL変更、0件・1件・複数所属を確認する。Astroの実描画試験でリンク、現在の最新回と完結の区別、文字のescape、追加runtimeがないことを確認する。
