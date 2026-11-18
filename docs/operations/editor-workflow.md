---
status: proposed
owner: development
last_verified: 2026-11-17
---

# CMSで記事を制作し、同じPRをAIへ渡す

## 人間の操作

/editor/を開き、通常はローカル保存で書き始める。Markdown/MDXが本文の正本で、ブロック編集とMDXソースの切替は同じ原稿への操作。公開日は執筆時に創作しない。画像は用途を選び、画質・文字・時間軸を確認してから私有媒体へ同期する。

GitHub接続後、読み込み元ブランチを選択する。固定commitの分類・部品契約を使い、内容をcontent/作業ブランチへ保存してDraft PRを作る。AIに渡すのは同じPR、ContentId、作業ブランチと最新commit。別端末の更新と衝突した場合は手元の原稿を保持し、remoteを比較する。force pushで上書きしない。

Draft PRの「Editor Astro layout preview」が成功したら、CMSの「Astroレビューを取得」で正規のレイアウトを表示する。公開CIは文章・CSSのみ、私有画像はその端末の確認済みhash/assetIdへ解決する。別端末では先に「別端末の画像を復元」を行う。原稿変更後は古いレビューを表示し続けず、最新commitの生成を待つ。表示専用のためブラウザツール操作は別のtool QAで確認する。

## HEIC・GIFを専用処理へ渡す

ブラウザがHEICを安全にdecodeできない場合、またはGIFを可逆WebPへ変換する場合は同じrepositoryの専用処理を使う。AIもこの入口を使い、独自の別上限・別encoderにしない。

```sh
npm run editor:media -- --input /path/to/source.heic --output .local/editor-media/prepared.json --kind photo --allow-lossy
npm run editor:media -- --input /path/to/simulation.gif --output .local/editor-media/motion.json --kind animation
```

生成したprivate媒体ファイルをCMSの「専用処理で変換したHEIC・GIFを取り込む」で読み込む。原本名とは別のassetIdで参照し、内容/hash/画素数/容量を検証する。写真のlossyマスターは撮影原本とは呼ばない。元のファイルは自動削除しない。コマンド自体はR2保存、外部AI送信、本番登録を行わない。

## AI引継ぎと公開

公開Draft PRを読み、固定commitとContentIdを確認して同じブランチへ追pushする。人間の入力にAIが実質的な本文や図版を追加した場合はproducerを偽装しない。編集時の未完成原稿と正式Article Jobの入力を区別する。

公開準備で必要な公開日・概要・権利・出典を確定し、既存の[記事制作手順](content-production.md)と[公開CI](article-media-publication-ci.md)へ引き渡す。CMSの保存やPRのReady操作は本人承認ではない。正式候補・実A/B/C保存・保護・export・通常CIの条件を満たしてから、別途認可された本番配信を行う。すべての記事にAIの全制作工程を人間の手作業として要求しないが、根拠や権利の事実をAIが推測で承認しない。

## 実環境の接続

GitHub Appは対象repositoryだけへインストールし、Contents read/write、Pull requests read/write、Actions read、Checks read、Metadata readを必要範囲として設定する。Callbackは公開サイト同一originの`/editor-api/auth/callback`。client secret、暗号化session secret、webhook secretはGitやブラウザへ配布しない。ownerの数値IDを認可条件にする。

Cloudflareのeditor-api WorkerにはDraft専用bucketだけをbindする。公開site Worker・公開/原本/保護bucketへこのAPIの権限を流用しない。GitHub push activityの署名検証と参照/保持試験が終わるまではGC_ENABLEDをfalseとする。providerのresource/route/secret作成はXpotato-Server側の認可済み設定工程で扱う。

ローカル・CIの合成GitHub/R2成功は、実際のApp認証、R2へのreadback、iPhone実機や本番配信の成功とは区別する。現時点の設定・受入れ状態は[実装状態](../architecture/cms-implementation-status.md)を確認する。

初回接続の実コマンドと不足項目の確認は[GitHub/R2接続手順](editor-connection.md)を使用する。App IDも検証し、対象repository一つへのinstallation以外はsessionを発行しない。
