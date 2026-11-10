# 固定配布物と履歴

## 現在の選択と保持範囲

選択の正本は[installations.json](../config/browser-tools/installations.json)、全pinは[release registry](../apps/site/src/content-registry/interactive/releases.ts)、Git復元元は[history.json](../config/browser-tools/history.json)。2026-11-10のmain `d3b522303fa310d91b06cefa950b822a0f4c56e3`を基準とする第三段階でもPrime **v0.2.5**を選択しています。追加・更新は`browser-tools:install`のplan/apply/checkを使い、固定配布物や生成wrapper/lockを手編集しません。

通常検証の対象は**全10pin**です。

- v0.2.5: 選択中。実vendorが必須です。
- v0.2.2・v0.2.3・v0.2.4: 固定main祖先`e862538b8cae2249fba7c8fe98a043d7f96b67f5`から検証・明示復元する3版です。本人が具体的に認可した[第三段階](../docs/operations/repository-hygiene-plan-20261109.md#第三段階のコピー撤去候補2026-11-10)で、一覧に一致する291ファイル（17,416,793 bytes）のtrackedコピーだけを撤去します。[保全対象の全path・mode・bytes・hash](../docs/migration/prime-history-retention-v1.json)と固定tree・全pin fingerprintは変更せず保持します。この一覧自体は将来の追加削除の許可ではありません。
- v0.1.0・v0.1.1・v0.1.2・v0.1.5・v0.2.0・v0.2.1: 固定main祖先`97d69d2858bf26346cd57815d7f7697ae81af1aa`から検証・明示復元する6版です。

選択版の実体不足は拒否します。履歴も展開済みならその現物を検査し、改変・不完全treeをGit fallbackで隠しません。未展開で既知の9版だけ固定Gitを同じcheckerへ渡します。missing object/path/mode/hash不一致は停止します。自動fetch/download、最新tag追跡、active-onlyへの検査削減はありません。

## 差戻しの準備

固定Gitへ移した版は、選択前に明示復元します。

```sh
npm run browser-tools -- restore --tool prime-factorizer --release v0-2-1
```

復元はlock/stage/同bytes再検証/atomic renameを使い、異bytesを置換せず、選択・掲載・公開もしません。その後のselectもfilesystemを検査します。v0.2.2〜v0.2.4も同じ復元入口を使い、未展開・復元・select・再展開後の改変拒否を隔離full-clone fixtureで検証します。

pin/review/source/license補足と公開MUSL URLを保持します。既存回帰はv0.1.0のprofile/font fallback、固定Git版v0.1.5の管理移管、v0.2.0のprovenance改変拒否を維持し、同じartifactをprivate fixtureへ復元して実行します。完全Git履歴とlegacy tagが必要で、plain archiveだけで履歴検証できるとは扱いません。

## PR141時点の記録

[ADR-0066](../docs/design/adr/0066-reproducible-repository-copy-retirement.md)の「選択v0.2.2・全7pin・旧6版489ファイル」はPR141作業時点の集合です。現在の版数ではありません。[PR141](https://github.com/Xpotato1024/xpotato-site/pull/141)は2026-11-04に`2850960722b46217329db78957c67b3086bee188`でmainへ統合済みです。作業当時のADR・撤去対象表・検証記録は改変せず残します。

後続の更新でv0.2.3〜v0.2.5が追加されました。第二段階の[PR170](https://github.com/Xpotato1024/xpotato-site/pull/170)は2026-11-10に`d3b522303fa310d91b06cefa950b822a0f4c56e3`でmainへ統合済みです。そこで実vendor4版を残して固定Git indexを9版へ増やし、第三段階で実vendor1版＋Git9版へ移行します。working treeの重複を減らす変更で、Git履歴の容量削減ではありません。main統合、Gitからの復元、本番への配信・本番rollback受入れはそれぞれ別の事実です。第三段階は別のDraft PRで確認し、merge・配信は行いません。
