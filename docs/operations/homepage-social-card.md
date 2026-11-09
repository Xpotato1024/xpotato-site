# ホーム専用OG画像の実装候補

この文書は、本人依頼の「加工した工作台写真＋文字、ボタンなし」を実装したDraft候補を記録する。merge・本番配信・SNS側での取得成功を意味しない。

## 表示と生成

- ホームと同じ凍結済み工作台写真から、1200×630のJPEGを1枚生成する。別の写真・AI画像・外部画像は取り込まない。
- 写真の低彩度化、コントラスト調整、左側を暗くするグラデーション、白い既存XPロゴ、「Xpotato.net」と英字の3行「Think.」「Build.」「Run.」、その下に小さく「ものづくり、プログラミング、日々の試行錯誤」を合成する。日本語の末尾に句点を付けず、ボタンは画像へ入れない。
- 英文見出しはサイト同梱のNoto Serif 400、ブランド名と日本語キャッチはZen Kaku Gothic New 400を使う。既存のフォント輪郭化処理を使い、OSフォント・SVGのtext要素・外部フォント・ブラウザー描画に依存しない。
- 英字を3行に分けたprofileは `home-workshop-social-v3`。写真の加工を保持し、ロゴ・ブランドを上部、94pxの英字3行を中央左、26pxの日本語キャッチを下部左へ配置する。文字の実際の輪郭でブランドと英字、英字の各行、日本語の間隔を検査し、重なりを防ぐ。画像のcontent-addressed URLも更新し、旧OGのURLを上書きしない。
- profileの正本は `apps/site/src/lib/home/home-workshop-social.ts`、生成処理は `tools/build/home-workshop/prepare-home-workshop-social.ts`。
- `readHomeWorkshopBuildPictures()` の `socialImage` をホームだけの `BaseLayout` に渡す。OGとTwitterの画像・寸法・代替テキストを既存の共通metadata処理で出力し、他ページのOG設定を変えない。私的な写真preview経路ではこのmetadataを接続しない。

## 来歴と配布境界

原本は既存 `apps/site/source-inputs` のSHA固定入力、正規化マスターは既存2400×1350の同一bytesを保持する。原本hash、マスターhash、profile、Sharp toolchain、同梱フォント・ライセンスmanifest、ロゴ、生成コード、輪郭化コード、合成overlay、出力hash・寸法・byte数を結ぶ。

`reviewed-recipe.json`、候補fingerprint、検証済みbinding、releaseの完全一致許可表を同期する。既存22個の写真派生物は不変で、OGを含む計23個だけを同じWorker用artifactへコピーする。OGは165,985 bytes、全23個の合計は4,344,763 bytes。候補JSON・マスター・overlay・ローカルパスは配布しない。Gitに新しいraster bytesを追加しない。

通常buildは外部fetch・upload・R2・Cloudflare・保護ストレージへ接続しない。Media Registryへの一般例外や公開receiptを作らず、[ADR-0034の限定接続](../design/adr/0034-editorial-identity-and-photo-led-home.md)と[モバイル派生画像](homepage-mobile-delivery.md)と同じ限定経路を使う。公開・merge・deployの認可は別途必要。

## 再生成と検証

既存の `prepare-home-workshop-media-cli.ts` が全23個を生成する。既存cacheに変更や不一致があれば自動修復せず停止する。必要なレビューのため再生成する場合は、既存cacheを別の私的ディレクトリへ保持してから新しい `.local/home-workshop-build` を生成する。

検証対象は、生成の再実行一致、画像寸法・metadata除去、Noto Serifの正確な3行と日本語キャッチの輪郭化・正確な文言・文字間の余白、source/profile/font/logo/code/hashの漂流、object数・path・bytesの完全一致、symlink escape・同一key異bytes拒否、OG/Twitterでの私的・外部・別名URL拒否。`home-workshop-build.test.ts`、`prepare-home-workshop-social.test.ts`、`bundled-outline-font.test.ts`、`manual-deployment.test.mjs`に回帰検査を置く。

この候補のローカル画像は生成後に実画素を確認した。ローカル試験とHosted CI、本番での配信確認、SNSサービスが保持するキャッシュの更新は別の検証として扱う。
