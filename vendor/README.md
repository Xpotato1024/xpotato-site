# 固定配布物と履歴

現在の選択はconfig/browser-tools/installations.json、Primeはv0.2.2。選択版は実vendor必須。追加・更新はbrowser-tools:installのplan/apply/checkを使い、手編集しない。

[ADR-0066](../docs/design/adr/0066-reproducible-repository-copy-retirement.md)は、選択中1版だけをworking treeへ保持し、旧6版のbytesをmain祖先97d69d2858bf26346cd57815d7f7697ae81af1aaのGit treeから復元する契約。config/browser-tools/history.jsonが各treeと全pin hashを固定する。現在は実コピー撤去待ちで、削除済みとは扱わない。

通常検証は**全7pin**を同じcheckerで照合する。選択版の実体不足は拒否。履歴も展開済みならその現物を検査し、改変・不完全treeをGitで隠さない。未展開の既知6版だけ固定Gitを検査。missing object/path/mode/hash不一致は停止。自動fetch/download、最新tag追跡、active-onlyへの検査削減はない。

差戻し前に明示復元する。

```sh
npm run browser-tools -- restore --tool prime-factorizer --release v0-2-1
```

復元はlock/stage/同bytes再検証/atomic renameで、異bytesを置換せず、選択・公開もしない。その後のselectも従来のfilesystem検査。pin/review/source/公開MUSL URLは保持。通常checkoutは選択1版、差戻し準備で追加した旧版は明示的な作業用コピーとなる。

既存回帰はv0.1.0のprofile/font fallback、固定Git版v0.1.5の管理移管、v0.2.0のprovenance改変拒否を維持し、同じartifactをprivate fixtureへ復元して実行する。完全Git履歴とlegacy tagを使い、plain archiveだけで履歴検証できるとは説明しない。
