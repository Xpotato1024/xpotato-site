---
status: accepted-design
owner: architecture
date: 2026-11-01
---

# ADR-0063: 記事保存を既存公開CIと標準S3 SDKへ集約する

本人は2026-11-01に、最低限のセキュリティ、毎記事の手間、開発・費用の継続可能性を優先し、既存GitHub Actions＋標準S3 SDK＋A/B/C限定の再利用R2トークン1組を選択した。設計・コード変更の承認であり、鍵発行・Secret設定・保護設定変更・merge・配信の実行承認ではない。実設定と実保存の受入れは未実施。

## 変更する条件

記事ごとの4鍵発行、3親のローカル署名、900秒の子JWT、手書きSigV4、broker、専用TTY、全Worker・全tokenの毎回inventory、本人失効確認を通常公開の前提から外す。Serverのoperator runtimeは撤去し、SiteのSDK保存経路だけを実装経路とする。Serverはbucket・公開設定・ロックのdesiredを所有し続ける。常設Worker、VPS、認証APIを追加しない。

旧ADR-0014/0015/0018/0020/0022のR2-first、本人承認、A/B/C、原文保全と権利条件は維持する。credentialのstage隔離・毎回policy観測を要求する旧記述は、本ADRの公開CIに限り置換する。過去のmock/fixtureはテスト専用であり、第二の本番経路ではない。既存deploy workflowのtoken、権限、固定Production artifactのguardは変更しない。

## 一つの運用経路

1. 正式Article Jobの内容・画像監査と来歴を照合し、公開可能なMDX・画像・compact lineageだけのpublication packageをローカル生成する。私有原稿履歴・根拠資料本文・非公開会話/Library ID・鍵は含めない。
2. 本人が同一GitHubリポジトリのdraft release assetとしてJSONを渡す。新サービスは不要。公開releaseへ昇格しない。CIはrelease/assetのowner、draft、完全SHA-256を照合する。入力はコードとして実行しない。
3. ownerがmainのexact SHA・asset ID・hashを選択し、保護Environment `site-production` の手動CIで承認する。PRの任意コードに鍵を渡さない。npm installは鍵を渡す前に `--ignore-scripts` で完了させる。
4. SDKでA→B→Cを保存・実bytes照合する。Bは公開HTTPSでも照合し、CにはBの実GET bytesを保存する。全照合後だけcanonical差分と真正な保存receiptをartifactへ出す。
5. 通常のPR検査・main統合・固定Production artifact・既存手動deployへ進む。保存CIは自動commit/merge/deployしない。最初の実装は新規記事に限定し、既存記事更新は未対応として拒否する。

SDKは `@aws-sdk/client-s3` をexact versionでlockする。`maxAttempts: 1`、`If-None-Match: *`、redirect禁止。存在時は完全GETのhash/size/MIME/cache一致だけをreuseする。不明PUTは再送せず停止し、失敗artifactの最後のkeyを確認して新しい手動 `verify-only` runで実GETだけを行う。完全照合できないとexportしない。Cの既存全prefix無期限Bucket Lockを維持し、CI鍵には設定・unlock・token管理権限を与えない。

## 初回設定と残るリスク

R2 Object Read & Writeを対象3bucketだけへ限定した再利用token1組を `site-production` Environmentの2つのSecretへ登録する。deploy用鍵とは別。鍵漏洩・CI侵害時にはA/B/Cのobject読取り・書換え・削除能力があることを受け入れる。条件付きPUTはアプリの制約であり侵害された鍵のIAM制約ではない。既存Cコピーの破壊耐性はBucket Lockによる。同一CFアカウントの管理者侵害から独立したバックアップとは主張しない。

設定の受入れは初回・設定変更時・異常時に行い、owner確認済みconfigのhashをreceiptへ記録する。これはfreshなprovider policy観測の証明ではない。初回Secret/Variable/Environment設定は別の具体的承認後に行う。毎記事の鍵作成・入力・失効はゼロ、鍵の失効/rotationは異常・期限・本人方針に従う。

## 監査対象と日付

本文・タイトル・分類・タグ・画像・権利・根拠・引用のsemantic hashは維持する。既存の実監査・private journalを偽造せず検査する。公開日/初回updatedDate/draft投影と無関係なGit commitだけでは内容・画像AI監査を全面再実行しない。画像や根拠が変われば対応する監査は失効する。過去の描画証拠は歴史証拠として保持し、現在版の表示は別の画面QAで確認する。

公開日はexport時のJST、初回updatedDateは付けない。deployが別日になる場合は実公開日のmetadataへ再投影し、hash・通常ビルド/SEO検査を更新する。日付だけでAIへ再送しない。

現行手順と未確認のGitHub設定は [公開CI運用](../../operations/article-media-publication-ci.md) を参照。

一次資料: [Cloudflare公式S3 SDK例](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)、[R2条件付き操作](https://developers.cloudflare.com/r2/api/s3/extensions/)、[AWS SDK retry設定](https://github.com/aws/aws-sdk-js-v3/tree/main/packages/config)。
