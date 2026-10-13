# 工房写真の修正候補（Draft・通常公開は未接続）

原本は旧サイトの`public/images/ui/hero-workshop-stage.jpg`（2400×1350、760,808 B）です。旧Git commit `2c50a80`で導入され、frozen legacy commit `927d105713561309fc5e2374396f86646b5aeb2a`に同一bytesが残っています。原本SHA256は`1daf2c4eb0519c2f04bec3a549b9f1711d9be1f1ca572d73c6352ea975fb00ca`です。採用A案のレビューでもこの写真が使われました。新しい生成画像への置換ではありません。

目視では人物・顔・住所・氏名・明瞭な非公開文書は確認されず、原本にEXIF/XMPはありません。撮影者の帰属は記録から確定できませんが、具体的な権利侵害を示す根拠も確認されていません。空の登録欄だけを新たな承認要件としません。

既存`photo-hero-v1`で幅640/960/1440/1920のAVIF・WebP・JPEGと公開用JPEG masterを私的候補として生成しました。全13 objectのhash、寸法、実容量は[候補情報](home-workshop-candidate-v1.json)です。総容量2,804,363 B、960pxのAVIFは56,525 Bです。各objectの計上値は実bytesから求めています。バイナリはGitへ追加せず、`.local`の候補に保持します。

`WorkshopPhoto.astro`と`home-workshop.ts`は、この限定写真のcontent-addressed URL、元寸法、標準pictureのAVIF→WebP→JPEG fallback、mobile coverのsizes、eager/high priorityを構成するrendererです。未接続であり、通常のホームは既存のreview flag条件のままです。一般のMedia Registry、44記事保留、CSP、provider設定、production eligibilityを変更しません。

新しいR2設定・ストレージ・アップロードを避ける接続案は、同一Git原本から最適化bytesをビルド時に用意し、既存Workerへ配信する同じ正式distの`media/v1/objects/sha256/...`へ含めることです。通常ビルド時の外部fetchは不要です。対象はこの既存写真1枚だけで、一般の写真をGitへ追加する例外ではありません。既存の正式artifact保存・復旧方式で当該bytesも扱う案として、通常buildへの接続と最終artifact検証を別途レビューします。R2の保存・公開・保護receiptが成立したとは記録しません。

このDraft段階でのprovider操作・配信は0です。通常buildへの接続は自動承認審査で明示許可不足として停止したため未実装です。接続許可後も、merge・deployは修正内容と最終検証を示した一括承認の対象です。
