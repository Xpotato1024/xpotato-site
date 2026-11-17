---
status: accepted
owner: architecture
last_verified: 2026-11-17
---

# ADR-0079: 公開Git下書き・専用CMS・非公開媒体ステージング

## 判断

本人が合意した目標に基づく実装候補。通常の記事は公開GitHubの作業ブランチとDraft PRを正本とし、人間とAIが同じMDXを編集する。サイト未掲載とソース秘匿を混同せず、公開PR・旧履歴の露出は一般技術記事の受容済みトレードオフとする。機密案件は最初から別private repositoryで扱う。

CMSは独立の内容正本を持たない。ブロック編集はMDXの該当source rangeを編集し、その他の構文を再生成しない。分類・部品スキーマは共通契約から生成し、選択ブランチの固定commitから読む。保存はcontent/配下の許可されたMarkdownだけ、作業ブランチだけ、expected headを照合した非force更新とする。mainへの直接push、公開フラグの変更、merge、deployをCMS APIに設けない。

## 正本と権限

- 公開済み本文の更新・正式export・A/B/C媒体保存は従来の本人承認と来歴を維持する。
- 制作中のdraft:true原稿は人間・AIが公開Gitへ保存できる。下書き保存を正式Article Jobの監査PASSや公開承認とはしない。
- 下書き画像は独立した非公開Draft R2へ保管する。未承認の写真・図版を公開媒体へ昇格しない。Draft API/GCはA/B/Cのbindingと削除資格情報を持たない。
- 値の正本はdesign-systemのCSS、媒体上限・期限の正本はeditor-core/policy.ts。文書とUIはこれを参照し、別々に定数を維持しない。
- GitHub Appトークンはサーバー側の暗号化HttpOnlyセッションに限定する。R2情報・署名付きURL・秘密値を公開PR/CI artifactへ出さない。

## レビューと媒体

通常の編集プレビューと正式なAstroレイアウトレビューを区別する。公開PRのCIは固定commitの公開MDX・部品・CSSだけから表示用パッケージを作る。非公開画像はCIへ渡さず、認証済みCMSのBlobとassetId/hashで結び付ける。表示iframeは同一originのBlob参照に必要なallow-same-originだけを許可し、allow-scriptsを決して組み合わせない。追加のchild CSPと要素除去によりscript・フォーム・リンク遷移を許可しない。レビューはsource commit/source SHAと画像revisionの変更で失効する。

端末で処理可能な画像は端末内で最適化する。HEIC非対応端末やGIFの可逆変換には、共有media-ingestの有界処理を使う。写真の非可逆変換は明示選択、技術図の画素・透明度とGIFの表示時刻・loopは保存する。専用処理は元ファイルを削除せず、下書き用マスターとプレビューを生成するだけで公開しない。

## 変更しない境界

公開siteは静的HTML主体、記事は不要なeditor runtimeを配信しない。検証を省略して完了扱いにせず、同一commitから1回生成した最終成果物を並列検証する。Cloudflare provider設定・GitHub App登録・本番配信・A/B/Cの実保存は別の実環境操作と認可が必要。Shadow DOM、人気記事、privateプレスサイトの実装は本変更に含めない。

## 受入れ

MDX往復・競合拒否・人間保存→AI追記→再取得、媒体容量の同時予約、認証/CSRF/原本hash、別端末復元、期限と参照に基づくGC、公開領域の操作拒否、Astro表示・CSP・オフラインキャッシュ境界を実装と試験で確認する。合成GitHub/R2試験を実サービスの受入れと呼ばない。実装状態・実行証拠は[実装状態](../../architecture/cms-implementation-status.md)とPRに集約する。
