# Site Operations Guide

この文書は `xpotato-site` の日常運用手順をまとめたものです。

対象:

- ブログ記事の追加
- 固定ページの追加
- 画像や配布物の置き場
- Cloudflare R2 の使い方
- GitHub と Cloudflare Pages の運用

## 1. 現在の構成

公開サイトの構成は次の通りです。

- 本番 URL: `https://xpotato.net`
- 公開配信: Cloudflare Pages / Workers Builds
- ソース管理: GitHub `Xpotato1024/xpotato-site`
- 記事本文: `src/content/blog/`
- 固定ページ: `src/content/pages/`
- 軽量画像: `public/`
- 重い画像や配布物: Cloudflare R2

基本方針:

- 本文は MDX で管理する
- まず GitHub に置くのはテキストと軽量資産だけ
- 重いファイルは R2 に分離する
- `xpotato.net` を正規 URL とし、`www.xpotato.net` は apex へリダイレクトする

## 2. ディレクトリの使い分け

- `src/content/blog/`: ブログ記事
- `src/content/pages/`: 固定ページ
- `src/content/notes/`: 補助メモ
- `src/content/projects/`: 制作物やサイト自体の記録
- `public/`: GitHub に置いてよい軽量な公開ファイル
- `doc/`: 運用文書

## 3. ブログ記事の作り方

### 3.1 作成場所

新しい記事は `src/content/blog/<slug>.mdx` を作成します。

例:

- `src/content/blog/my-first-post.mdx`

記事 URL は次になります。

- `https://xpotato.net/blog/my-first-post/`

### 3.2 Frontmatter

最低限必要な frontmatter:

```mdx
---
title: 記事タイトル
description: 記事の要約
pubDate: 2026-03-12
updatedDate: 2026-03-12
category: blog
tags:
  - astro
  - cloudflare
draft: false
---
```

任意で使える項目:

- `updatedDate`
- `category`
- `tags`
- `heroImage`
- `ogImage`
- `legacyPath`
- `canonical`

### 3.3 書き方の基準

- `title`: 一覧や検索結果でそのまま読める題名
- `description`: 1文で内容がわかる要約
- `pubDate`: 公開日
- `updatedDate`: 後から内容を直した日
- `draft: true`: 未公開にしたいとき

### 3.4 記事作成の手順

1. `src/content/blog/<slug>.mdx` を作る
2. frontmatter を埋める
3. 本文を書く
4. 軽い画像なら `public/` に置く
5. 重い画像なら R2 に置く
6. ローカルで build する
7. GitHub に push する
8. Cloudflare 側の deploy を確認する

## 4. 固定ページの作り方

### 4.1 作成場所

固定ページは `src/content/pages/<slug>.mdx` を作成します。

例:

- `src/content/pages/about.mdx`
- `src/content/pages/contact.mdx`

URL は次になります。

- `https://xpotato.net/about/`
- `https://xpotato.net/contact/`

### 4.2 Frontmatter

```mdx
---
title: About
description: このページの説明
pubDate: 2026-03-12
updatedDate: 2026-03-12
summary: ページの要約
draft: false
---
```

### 4.3 固定ページ作成の手順

1. `src/content/pages/<slug>.mdx` を作る
2. frontmatter を埋める
3. 本文を書く
4. 必要なら `src/lib/site-config.ts` の navigation を更新する
5. ローカルで build する
6. GitHub に push する

## 5. 画像とファイルの置き方

### 5.1 GitHub に置くもの

次は GitHub / `public/` に置いてよいです。

- 数百 KB 程度の画像
- OGP 用画像
- 小さな PDF
- favicon やアイコン

### 5.2 R2 に置くもの

次は R2 に置く前提で考えます。

- 元画像
- 大きいスクリーンショット
- 配布用 ZIP
- 長期的に増えそうな画像群
- Git 履歴を重くしたくない資産

### 5.3 判断基準

- 軽量で数も少ない: `public/`
- 重い、増える、差し替えが多い: `R2`

## 6. R2 の使い方

### 6.1 推奨構成

- bucket 名: `xpotato-assets`
- custom domain: `assets.xpotato.net`

公開 URL 例:

- `https://assets.xpotato.net/blog/my-first-post/hero.jpg`
- `https://assets.xpotato.net/downloads/tool-v1.zip`

### 6.2 配置ルール

パスは用途ごとに固定します。

- `blog/<slug>/...`
- `pages/<slug>/...`
- `projects/<slug>/...`
- `downloads/...`

### 6.3 R2 への配置手順

1. Cloudflare の R2 bucket を開く
2. 対象ファイルを upload する
3. custom domain 経由の URL を確認する
4. 記事やページ本文の参照先をその URL にする

例:

```mdx
![hero](https://assets.xpotato.net/blog/my-first-post/hero.jpg)
```

### 6.4 注意点

- R2 に置くファイル名は ASCII ベースにする
- 記事 slug とパスを合わせる
- 同じ画像を差し替えるときは URL を固定すると管理しやすい

## 7. ローカル確認

この環境では Docker 経由で Node コマンドを実行します。

依存関係のインストール:

```bash
docker run --rm \
  -v /mnt/d/Xpotato-apps/xpotato-site:/app \
  -w /app \
  node:20-bookworm \
  bash -lc "npm install"
```

本番ビルド確認:

```bash
docker run --rm \
  -v /mnt/d/Xpotato-apps/xpotato-site:/app \
  -w /app \
  node:20-bookworm \
  bash -lc "npm run build"
```

開発サーバー:

```bash
docker run --rm -it \
  -p 4321:4321 \
  -v /mnt/d/Xpotato-apps/xpotato-site:/app \
  -w /app \
  node:20-bookworm \
  bash -lc "npm install && npm run dev"
```

## 8. GitHub の使い方

### 8.1 基本フロー

1. ローカルでファイルを編集
2. `npm run build` で確認
3. Git で commit
4. GitHub に push
5. Cloudflare 側の build を確認

### 8.2 最小コマンド

```bash
git status
git add .
git commit -m "Add blog post"
git push
```

### 8.3 推奨運用

- 小さい変更は `main` へ直接 push でもよい
- 大きい変更は branch を切って PR を使う
- 重いファイルは commit しない

## 9. Cloudflare Pages / Workers Builds の使い方

### 9.1 現在の想定

- GitHub リポジトリ: `Xpotato1024/xpotato-site`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

### 9.2 デプロイの流れ

1. `main` に push
2. Cloudflare が build を実行
3. `xpotato.net` に反映

### 9.3 確認ポイント

- `xpotato.net` が `200`
- `xpotato.net/blog/` が `200`
- 必要なら `about/` など固定ページも確認
- custom domain が `Active`

## 10. 公開後の確認項目

更新後は次を確認します。

- `https://xpotato.net`
- `https://xpotato.net/blog/`
- 追加した記事 URL
- 追加した固定ページ URL
- 画像 URL
- `robots.txt`
- `sitemap-index.xml`

## 11. WordPress 由来コンテンツの扱い

- 記事本文は手動移植を原則とする
- バックアップは参照元として使う
- 自動変換結果をそのまま正本にはしない

詳細は `doc/manual-post-migration.md` を参照します。

## 12. 運用の原則

- 正規 URL は常に `https://xpotato.net`
- `www.xpotato.net` は apex へリダイレクト
- 本文は Git で管理
- 軽量資産は repo、重量資産は R2
- 公開配信は Cloudflare、VPS は他サブドメインと公開境界のために維持
