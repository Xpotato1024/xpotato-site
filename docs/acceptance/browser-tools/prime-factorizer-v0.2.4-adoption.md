# Prime v0.2.4の固定版更新候補

既存Draft PR154をv0.2.4へ更新する。ContentId・route・本文・公開状態は維持し、共通installerのplan/apply/checkを使用する。旧v0.2.3以下のvendor・pin・ライセンス資産は保持する。サイトのReady化・マージ・本番デプロイは行わない。

公開タグ対象: `eb66274e6dff8523bedc244a277686115610238e`。タグobject: `898bd0b0ed39230a2eb948c8a5cb086e468ce123`。Git tree: `f4d66ba545f709398d9b2596079dea024840ee7d`。

| 資産 | bytes | SHA-256 |
| --- | ---: | --- |
| RELEASE-PROVENANCE.json | 12537 | `b9c724ed705a88d887de8afad12ff956cc66a2220bb0b59d3c94d1d8151bf9e1` |
| SHA256SUMS.txt | 392 | `efff3ea6bb5fe5c32ac01ae7f891367114b38ab38e227274dbf45f77c8181c0c` |
| browser-acceptance-v0.2.4.json | 113801 | `a1edc04d3747916505fa1c560b0cdddcf09714cca362a340b07596ffdf585c8f` |
| browser-prime-toolkit-v0.2.4-source.zip | 38691821 | `a0d98a374737651722ad2c80113d43aee21c68bad85bcdc6550c97e598b0ef25` |
| browser-prime-toolkit-v0.2.4.zip | 2149354 | `e3a5337d48149e5f0b422d3d008567cb233877e9b6d40037aecd655f5a1c83e9` |

runtime tree: `6a7802b380e782e256b4f01da4b72ca59ee510e7b5102d588f899e7f78b070f7`。manifest: `592be95ecb79c1c16a48564ec6d1ca7b0b6c7cbd47f1c51aba3e500fadc239be`。5公開資産を匿名HTTPSで取得し、GitHub digestとローカル資産のbytesへ照合した。対応ソースZIPはタグ対象の全追跡Git blobとexact-setで一致する。独立した2つのclean cloneの97ファイルが一致し、独立source/releaseレビューで指摘なし。

修正はtoolkitのゲージ規則へ `border: revert` を追加したもの。サイトvendorは手編集しない。上流の全854テスト・check・main/tag CIを確認する。Linux ChromiumとWindows Edgeでstandaloneとhost相当の実配布物を確認し、通常完了・未証明・取消・時間切れ・新入力・再実行を区別する。強制色はネイティブ配色に追従する。

サイトの最終headと最終ビルドで全体テスト・型・静的検査・操作・資源解放・レイアウト・実ピクセルを確認し、Hosted CIを既存Draft PR154へ記録する。CSS計算値だけで紫と判定しない。実機mobile・Safari/Firefox・実OSハイコントラスト設定・実スクリーンリーダー・本番デプロイは未検証として区別する。
