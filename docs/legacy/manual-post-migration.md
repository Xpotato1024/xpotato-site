# Manual Post Migration

この文書は、WordPress 記事を Astro/MDX へ手動移植する際の作業基準です。

## 固定方針

- 記事本文と軽量アセットは GitHub で管理する
- ブログ本番配信は Cloudflare Pages を第一候補とする
- 重い公開メディアは Cloudflare R2 へ分離する
- 切替は短時間停止を許容した一括切替
- 移行対象は `post` のみ
- WordPress の `page` は移行しない
- 本文は手動移植し、WordPress の HTML をそのまま正本にしない
- URL は当面 `/blog/[slug]/`

## 記事ごとの手順

1. WordPress の公開記事を開き、タイトル、公開日、更新日、画像、外部リンクを確認する
2. `src/content/blog/<slug>.mdx` を作る
3. frontmatter を埋める
4. 本文を MDX として再構成する
5. 画像を `public/` に配置し、参照パスを差し替える
6. 旧 URL を残す必要がある場合だけ `legacyPath` を記録する
7. `npm run build` で確認する

## Frontmatter 例

```mdx
---
title: 記事タイトル
description: 記事の要約
pubDate: 2026-03-12
updatedDate: 2026-03-12
category: tools
tags:
  - astro
  - migration
draft: false
legacyPath: /?p=34
---
```

## 移植時の注意

- 見出し階層を WordPress より優先する
- shortcode は残さず、必要なら Astro / React コンポーネントへ置換する
- 不要な装飾用 HTML は削る
- 旧 URL を無理に再現しない
- demo 残骸やテンプレート由来の文言を混ぜない
