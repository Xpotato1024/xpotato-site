# 工房写真の接続（PR98・未配信）

原本は旧サイトの`public/images/ui/hero-workshop-stage.jpg`（2400×1350、760,808 B）です。旧Git commit `2c50a80`で導入され、frozen legacy commit `927d105713561309fc5e2374396f86646b5aeb2a`に同一bytesが残っています。原本SHA256は`1daf2c4eb0519c2f04bec3a549b9f1711d9be1f1ca572d73c6352ea975fb00ca`です。採用A案のレビューと同じ写真を使い、生成画像への置換は行いません。

目視では人物・顔・住所・氏名・明瞭な非公開文書は確認されず、EXIF/XMPもありません。撮影者の帰属は記録から確定できませんが、具体的な権利問題を示す根拠も確認されていません。通常ホームへの接続をDraftで実装・検証する本人の明示許可を受けています。

既存`photo-hero-v1`で幅640/960/1440/1920のAVIF・WebP・JPEGとJPEG masterを生成します。[私的候補の実測](home-workshop-candidate-v1.json)は13 object・総2,804,363 B、960px AVIFは56,525 Bです。正式ビルドは同じsource・profile・toolchain・実bytes/hashを検証し、metadataの相違やobject欠落を停止条件とします。バイナリをGitへ追加しません。

`homeWorkshopIntegration`は私的な`.local`に生成した限定objectを同じ正式distの`media/v1/objects/sha256/...`へcopyします。`WorkshopPhoto`はregistryの寸法・hash付きURLから標準picture、AVIF→WebP→JPEG fallback、mobile coverのsizes、eager/high priorityを構成します。新規provider設定・R2作成・upload・課金は不要です。ビルド時の外部image fetchもありません。

この既存ホーム写真1枚を既存Workerの静的artifactで扱う限定接続です。一般のR2-first media、44記事保留、CSP、production eligibilityの契約は変更しません。R2の保存・公開・保護receiptが成立したとは記録せず、復旧元は既存Git原本と正式artifactです。SITE_PREVIEW_WORKSHOP=1の私的レビュー経路も保持します。

正式distのブラウザ検証はdesktop/390/375/320pxで実decode・URL・寸法・CTA・横はみ出しを確認し、写真503時の暗い背景・layout維持・メニュー回帰も検査します。実機Brave iOSの確認は別に残ります。

本番配信はこの実装許可に含みません。最終head・正式artifact・CI・表示結果を示し、merge/deployは本人の一括承認後です。
