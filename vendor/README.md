# 固定配布物の所有

このdirectoryは独立ツールの正式artifactとlicense補足。開発sourceや編集用コピーではない。追加・更新は`browser-tools:install`のplan/apply/checkを使う。

現在の選択は`config/browser-tools/installations.json`で定まり、Primeは`v0-2-2`。他の6版は**履歴検証・選択時の復旧用immutable artifact**として保持する。無期限に「必要かもしれない」と残しているのではなく、次の現契約と実参照がある。

- `apps/site/src/content-registry/interactive/releases.ts`は全7版のpinを保持する。
- `packages/site-validators/src/tool-runtime-policy.ts`は通常検証でも全pinの実bytesを`verifyToolPin`で再照合する。
- `browser-tool-bounded.test.ts`・`prime-profile.test.ts`・`font-subsets.test.ts`のv0.1.0、`browser-tool-manual-migration.test.ts`の固定Git版v0.1.5、`browser-tool-prime-provenance.test.ts`のv0.2.0には具体的な回帰入力がある。現役選択のv0.2.2と合わせて経路を区別する。
- `docs/contracts/browser-tool-adoption.md`は旧bytes/pin/review保持と再downloadなしの旧版選択、`browser-tool-authoring.md`も旧vendor保持を定める。

旧6版のworking-treeコピーを除去する場合は、全pin再照合と旧版選択に使う**固定Gitからの復元を含む契約改訂**が先に必要。単に通常検証をactive版だけへ変えて削除しない。別subrootへの移動だけでは容量は減らずresolverが増えるため採用しない。旧版public MUSL license URLと補足も維持する。

現在の全pin検証・回帰を維持する限り、この7版は保守対象である。次の新release採用時に選択版を確認し、履歴保持方針を変更するなら独立したreviewで同bytes復元・旧版選択・license URLの回帰を示す。
