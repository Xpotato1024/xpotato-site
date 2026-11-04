# CI・配信・監視の運用コード

日常の作成・更新・build補助・画面QAは[tools](../tools/README.md)。ここはGitHub Actionsと配信consumerが実際に使う運用コードだけを所有する。

| 場所 | 現役の責務 |
|---|---|
| rootの4ファイル | CI scope判定、conditional scope、scopeとrelease graphの回帰試験 |
| release/artifact | 固定artifact取得・展開・staging・Windows受入れのPowerShell |
| release/deployment | 配信計画、owner/main/manual/Environment検査、配備状態と公開照合、復旧 |
| release/monitoring | 既存監視・readiness・一回限りbootstrapとその回帰試験 |
| release/shared | 制限付きHTTP読取り、応答上限、domain証跡、公開readbackの共有部品 |

CLI名・引数・既存npm名は維持する。workflowの実呼出しpathは新配置へ更新した。記事画像のR2保存はtools/publicationの別操作であり、ここに別の保存・配信入口を追加しない。

記事描画・既成稿取込み7本はtools/review/articlesへ移した。現在のrenderProducerPathsも同時更新し、新しいcontextは新pathで固定する。旧contextは当時の固定Git revisionで再現し、hash固定の過去証跡を新pathへ書き換えない。

旧WordPress importer、statusだけを見るcurl確認2本は廃止。必要な旧版の調査はGitの792580d7088c0a1e0aebe3857185f3a87968a502:scripts/<旧filename>から行う。現役の検証へ復活させない。

監視コードの移動は監視再起動・承認再利用・incident解除を意味しない。過去の承認記録・消費状態はそのまま保持し、将来の実行は変更後のsource fingerprintと既存の認可条件で検査する。
