# Prime v0.2.3 の固定版更新候補

サイト基点は `eb2eecae01e31238577b3c4987013313caa40a48`。既存の本文、ContentId、route、公開状態と他PRの作業は維持する。正式Releaseの公開確認後、共通installerで独立ブランチへ取り込む。サイトのマージ・本番配信は行わない。

[正式Release](https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.2.3) のタグ対象は `833e52c94c71a72a22cebaad1ca124d2a37cbd1c`、注釈tag objectは `d7ed5f628e9b5066aa4a2f01f06d8b3d8a07ea4b`、Git treeは `3218f4027eb70acd4fc7a0bac76d63f3f3d6fbfb`。

| 資産 | bytes | SHA-256 |
| --- | ---: | --- |
| RELEASE-PROVENANCE.json | 57821 | `5acfb40b41f706802c1bf83605a09bbc2adb00800f382f3272c823b65677de7b` |
| SHA256SUMS.txt | 392 | `134bdacc19f48acd2acb2b7520bdaae80d9d7b8e145a07db08df2afcf0890f35` |
| browser-acceptance-v0.2.3.json | 33373 | `87ae8094460b6792c14d7b3aaaa636e6649e6c01860985cab7757553cd068bc7` |
| browser-prime-toolkit-v0.2.3-source.zip | 38684957 | `ec12748e4f0c5ab5b1d4f86bcbe9d782ef217fe86e37b3b4973c21f9771fb07a` |
| browser-prime-toolkit-v0.2.3.zip | 2149139 | `3eb33db93e9190ad5c73c6b44f9f7b074ffda236335e11b03655cca2c06dea59` |

runtime tree: `cd716221c04bccce95172f2ee5f6ede91df740586c14b65ade71e0dba9b85520`、manifest: `c9498549b5025af7b856c7a3c2c6cd1d00c1930387cc80ff5d7d229b55722f73`。5資産を匿名HTTPSで取得し、公開API digestとローカル配布bytesを照合した。対応source ZIPは追跡Git blobのexact-setと一致する。

上流の最終ソース854試験・check、独立clean checkout 2件の全ファイル一致、Edge156のGUI23件・結果状態10件・minify後7件と独立source/releaseレビューを再利用する。サイト側でtoolkitを再buildせず、取得した正式bytesを採用する。初回のChrome起動timeoutと同一SHAの一度の再実行成功はprovenanceに区別して記録されている。根因の確定や期限緩和は行っていない。

共通installerのplan/apply/checkで選択pin、exact public admission、npm依存/lock、生成registry、immutable vendorとライセンス公開pathを更新する。旧版は上書きしない。

配布元の改善に合わせ、実dist受入も0.2.3のGUIを選択し、確定・未証明・不明、正常終了の満杯と取消/timeoutの空ゲージ、新入力、複合入力の要約・コピー・AXを確認する。既存のminify後ECM回帰、offline、通信、Worker/Blob退役、複数island、navigation、明暗・狭幅・文字200%を維持する。実際の実行結果とexact site headのCIは対応Draft PRに記録する。

実機iOS/Android、Safari/Firefox/WebKit、OSキーボード・共有/clipboard UI、実スクリーンリーダー操作、本番配信・公開後readbackは未実施。通常309桁/1024bitは受付範囲で完走保証ではなく、333〜400bitは実験的である。素数検査の固定基数へ確率数値や「ほぼ確定」の保証を追加していない。
