---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - Blog frontmatter contract
  - content metadata derivation rules
---

# Blog Frontmatter Contract

## Goal

通常Blogでは、著者・AIがSEO boilerplateやasset storage detailを入力しない。

frontmatterはstable content identity、editorial metadata、exception-only overrideだけを保持する。

canonical URL、OGP、JSON-LD、archive membership、hero / social assetはsystemが導出する。

## Exact logical shape

```ts
interface BlogFrontmatter {
  id: ContentId;

  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  publishedAt?: string;
  updatedAt?: string;

  category: CategoryId;
  tags: TagId[];

  draft: boolean;
  featured?: boolean;
  cardDisplay?: { lines?: string[] };

  legacyUrls?: string[];

  seo?: {
    canonicalOverride?: string;
    noindex?: boolean;
    titleOverride?: string;
    descriptionOverride?: string;
  };
}
```

per-entry `schemaVersion`は持たない。collection schema versionは`content-contracts` implementationが所有する。

## Required fields

- `id`
- `title`
- `description`
- `pubDate`
- `category`
- `tags`
- `draft`

`id`は`content-identity-contract.md`に従うmachine-generated stable identity。authorが意味を込めて手入力するfieldではない。

## Title / description

`title`は人間向けtitleの正本。

`description`は一覧 / meta description / share summaryの共通source。

通常は別`summary`を持たない。

## Date

ISO date。

`updatedDate`はmaterial content updateだけで更新する。formatting-only / typo-onlyで自動更新しない。

任意の `publishedAt` / `updatedAt` は実際に記録した公開・改訂日時です。秒と時差を含むISO 8601文字列（例 `"2026-11-12T12:00:00+09:00"`、またはZ）を引用符付きで記入します。小数秒は3桁まで。JSTへ換算した日付が対応するpubDate/updatedDateと一致し、両日時がある場合は更新が公開より前にならないことをschemaで確認します。updatedAtだけを記入してupdatedDateを省略することはできません。

日時不明なら省略します。日付の0時、Git日時、build日時を補わず、既存記事の日付をNEW表示のために書き換えません。NEWは正確な日時があれば0〜72時間で判定します。日付だけなら、そのJST日の最早境界からでも72時間以内と確定する場合に表示します。暦日差0〜2日は表示、3日前は通常未確定で非表示です。端点を含むためJST午前0時ちょうどだけは3日前も範囲内で、1ms後には未確定になります。この境界を実更新時刻として保存しません。不正・未来の明示日時を日付だけへ救済しません。同日の公開と改訂はホームで1件にまとめ、明記した改訂時刻を使います。完全な複数回改訂履歴ではありません。

CI記事公開経路も明記した日時を維持しますが、実行日に決まる日付との矛盾、実行時点より未来の日時を拒否します。公開後のpublishedAt変更、metadata_only/media_onlyによるupdatedAt変更は拒否します。実更新で日時を記入しない場合は日付だけとし、過去の更新日時を新しい更新へ流用しません。承認済みpackageの日時変更はsemantic identityに含まれ、既存の承認・再準備の規則に従います。

## Hero / social derivation

Blog mediaはMedia Asset Registryから`id`で解決する。

published Blog:

- exactly one active `role=hero`
- exactly one active `role=social_card`

frontmatterは:

- R2 object key
- domain
- camera / AI origin
- provider/model
- actual dimensions

を知らない。

標準social cardは本人採用のC。任意cardDisplay.linesは元titleを分割する表示専用text配列で、SEO overrideや任意HTMLを受け取らない。schemaは文字一致・禁則・境界を検証し、字体依存の収容検査は実rendererで行う。生成と公開の境界は[Blog標準SNSカードC](../operations/articles/social-card.md)を参照。

## SEO derivation

- canonical URL = collection route + current slug
- OG title = `seo.titleOverride ?? title`
- meta / OG description = `seo.descriptionOverride ?? description`
- OG image = active `social_card`
- BlogPosting image = active hero / social policy
- sitemap = `draft=false && noindex!=true`

`seo`はexception-only。

## Legacy URLs

`legacyUrls`はredirect identity evidence。

recordしただけでredirect activeとはみなさない。

## Slug versus ID

slugをfrontmatter fieldにしない。

slugはfile path / route handleから導出する。

```text
id   = stable content identity
slug = mutable route identity
```

slug renameでも`id`を変えない。redirectを同じchangeで設計する。

## Validation

- ContentId globally unique
- title / description non-empty
- category active
- all tags valid
- duplicate tag禁止
- pubDate <= updatedDate if updated exists
- published Blog hero exactly one
- published Blog social card exactly one
- media provenance / visual audit valid where required
- legacy URL duplicate禁止
- canonical override absolute HTTPS URL
- draft=falseでpublication blocker 0
