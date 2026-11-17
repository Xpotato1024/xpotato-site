# Schema

Zod契約の正本は `packages/content-contracts/src/`。JSON Schemaが必要な連携先だけ `npm run schema:generate` で `.local/schemas/` へ生成します。生成JSONのコピーや鮮度比較のために旧契約をmainへ保持しません。生成の決定性と登録漏れは一時directoryを使う単体テストで検証します。

`release/release-package.schema.json` は配布形式を記述する手書き契約です。公開・展開時の実検証はrelease producer/consumerが行います。
