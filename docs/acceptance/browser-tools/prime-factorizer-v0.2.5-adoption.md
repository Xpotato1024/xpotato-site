# Prime v0.2.5のUI更新候補

Toolkit [PR 46](https://github.com/Xpotato1024/browser-prime-toolkit/pull/46) のレビュー済み固定コミット `9cf35474d7b4b477d16fa9e3094450d9418cf3e7` を採用する。PR 46はmerge済みだが、可変mainではなくレビュー済みsource/artifactを固定する。タグ・GitHub Releaseは作成しない。

サイト[PR 163](https://github.com/Xpotato1024/xpotato-site/pull/163)と[PR 165](https://github.com/Xpotato1024/xpotato-site/pull/165)を統合したmain `22070b4a7d14e6cfcf4276416e28c3df136549c1` の0.2.4から更新する。この変更のmerge・Ready化・本番公開は含めない。

## 変更

- 分解式の枠内にコピーアイコンを置く。名前「結果をコピー」、44pxの操作領域、キーボードフォーカス、成功・拒否時の通知を維持する。
- 「結果の詳細」と「使い方・ヘルプ」を分ける。未完了・未証明の説明をToolkit側へ集約し、ページ本文との重複をなくす。
- ページの名称・説明・短い導入と既存PWA案内を維持する。重複するDetailsだけを取り除いた本文と既存の手動編集provenanceのhash一致を確認して再適用する。凍結移行baselineは変更しない。

## 固定成果物

- source tree SHA-256: `9c66d80153d6bb3fc238d1d324bdb38c4f29c273632ce1d5a5b2278facba6576`
- lock SHA-256: `b99e423acd7deddc825ce270b29e4da7c6e4639f70833bb092fefda1567f4105`
- manifest SHA-256: `ba3dd586aa8082e9dbc52832083fddad739495589705243048307962511e2b42`
- artifact SHA-256: `100c11520b46fb3975429dbdaf95a590775f07d5e1b3e43f7699dde5cff0880f`

独立した2つのクリーンcloneによる97ファイルのビルド出力が一致する。既存v0.2.4との実配布差分はUI・固定フォント文字列・版・manifest/provenanceのみ。数値処理、Worker/WASM、資源制限、ライセンス本文はbyte一致し、変更していない範囲は既存の独立レビューを再利用する。詳細は同ディレクトリー配下の `prime-factorizer/v0-2-5-source-review.json` に記録する。

採用は共通installerのplan/apply/checkを使い、vendor・生成物は手編集しない。旧版とライセンス資産を保持し、ContentIdとrouteは変えない。

## 検証範囲

source reviewに記録した二つの独立clean build、レビュー範囲と未変更部分の根拠を再利用する。今回は正規GitHub originを持つ既存repositoryからexact sourceのclean detached worktreeを作り、正式installerのplan/applyを再実行した。ネットワーク取得や公開操作は行っていない。

実distの操作検査は0.2.5のコピーアイコン、通知、結果の詳細2群とヘルプ1群を明示検査する。最終headの通常CIで操作・PWA保存/オフラインを検査する。モバイルはviewportエミュレーションであり、実機iOS/Android、実スクリーンリーダー、Safari/Firefox、OSクリップボードへの書込み、本番配信は新たに検証していない。
