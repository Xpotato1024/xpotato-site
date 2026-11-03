# Schemaの所有と生成

`generated/`はcontent-contractsのZod正本から生成するJSON Schema。content・interactive・article・media・disclosure・examples・migration・publicationの8責務に分ける。名前とschema本文は維持し、外部参照のない82件を同bytesで移動した。分類の正本は`packages/content-contracts/src/schema-groups.ts`で、未分類・重複・余分な生成物は検査を失敗させる。

```sh
npm run schema:generate
npm run schema:check
```

生成JSONを手編集しない。新schemaはZod registryと所有分類へ登録する。`release/release-package.schema.json`は配布packageの独立した手書き契約で、生成物と区別する。

旧commitのschema URLはGit履歴の同じbytesへ固定される。公開HTTP schemaサービスや新しいURI namespaceは追加しない。
