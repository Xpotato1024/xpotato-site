# xpotato-site

WordPress から Astro へ移行するための公開サイトリポジトリです。

現在の方針:

- 記事や設定は GitHub で管理する
- ブログ本番配信は Cloudflare Pages を第一候補とする
- 重い公開メディアは Cloudflare R2 へ分離する
- 切替は短時間停止を許容した一括切替
- 移行対象は記事のみ
- 記事本文は WordPress から手動で MDX に移植
- 旧 WordPress の固定ページやテンプレート残骸は移行しない

補足:

- `VPS nginx` は引き続き Home-Servers 公開面の境界装置として維持する
- Home-Servers の大容量ストレージは元データやバックアップ保管に使い、ブログ公開面の直接代替にはしない

## Stack

- Astro
- React islands
- Tailwind CSS
- MDX + Content Collections
- Cloudflare Pages
- Cloudflare R2
- Python import script for WordPress backups

## Setup

この環境では WSL 側に Node.js が入っていないため、Node 系コマンドは Docker コンテナ経由で実行します。

依存関係のインストール:

```bash
docker run --rm \
  -v /mnt/d/Xpotato-apps/xpotato-site:/app \
  -w /app \
  node:20-bookworm \
  bash -lc "npm install"
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

本番ビルド:

```bash
docker run --rm \
  -v /mnt/d/Xpotato-apps/xpotato-site:/app \
  -w /app \
  node:20-bookworm \
  bash -lc "npm install && npm run build"
```

## Cloudflare Pages

Cloudflare Pages で使う基本設定値:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

`xpotato.net` を production custom domain に割り当て、`www.xpotato.net` は必要に応じて正規 URL へリダイレクトします。

Cloudflare の現行 UI で `Workers Builds` フローに入る場合は、`Build output directory` を画面で入れる代わりに
リポジトリ内の `wrangler.jsonc` で静的アセット配信先を指定します。

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Asset directory: `./dist` (`wrangler.jsonc` で指定済み)

## Manual Migration

記事本文の移行は手動で行います。基本運用は次の通りです。

1. WordPress 上の元記事を確認する
2. `src/content/blog/` に新しい MDX を作る
3. タイトル、説明文、公開日、必要なら `category` と `legacyPath` を付ける
4. 本文は Astro/MDX 向けに整えて書き直す
5. 必要画像だけ `public/` に配置する

日常運用全体は `doc/site-operations-guide.md` を参照してください。

## WordPress Import Reference

WordPress バックアップから既存記事や画像を参照するための補助スクリプトです。
本文の全面自動移行を主目的にはしません。

```bash
python3 scripts/import_wordpress.py \
  --sql /mnt/d/Xpotato-cloud/backups/vps/2026-03-11-043009/wordpress-db.sql.gz \
  --media /mnt/d/Xpotato-cloud/backups/vps/2026-03-11-043009/wp-content.tar.gz \
  --site-root /mnt/d/Xpotato-apps/xpotato-site
```

生成物:

- `src/content/blog/*.mdx`
- `src/content/pages/*.mdx`
- `public/wp-content/uploads/**`
- `tmp/wordpress-import-report.json`
