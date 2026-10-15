---
status: proposed
owner: operations
last_verified: 2026-10-15
canonical_for:
  - local article visual and complete candidate preview CLI
---

# 画像と完全候補の非公開preview

A4は[内容review](local-content-review.md)のCONTENT_READYから、決定的hero/social、画像監査、Media Registry、共有Astroレイアウトのpreview、本人review束を作る単位です。本人承認、保存/protection、exportはA5/A6に残ります。公開記事や旧44記事のholdを変更しません。

## 操作

新jobはinit時に --local-media-processing を指定します。既存jobの権限上限は変更できません。native画像処理は専用packageで行い、通常site buildから実行しません。

~~~text
npm run site -- article visual plan --job <job-id> --from /absolute/path/visual.json --json
npm run site -- article visual materialize --job <job-id> --json
npm run site -- article visual-audit prepare --job <job-id> --json
npm run site -- article visual-audit import --job <job-id> --from /absolute/path/audit.json --json
npm run site -- article media prepare --job <job-id> --json
npm run site -- article candidate build --job <job-id> --reference --json
npm run site -- article validate --level candidate --job <job-id> --candidate <target-sha256> --json
npm run site -- article review prepare --job <job-id> --candidate <target-sha256> --json
npm run site -- article candidate preview --job <job-id> --candidate <target-sha256> --json
~~~

入力型は[共有schema](../../packages/content-contracts/src/article-visual.ts)と生成JSON Schemaが正です。visual planのfrom省略は表紙生成・inlineなし・配信計画未確認です。mediaPlan=nullを黙って確定扱いしません。

独立した人がmasterの実物を確認し、prepareのexact request/asset hashに監査を結びます。author/producerとreviewerのprincipalを分け、全assetのquality/rights/accessibility/禁止含意と公開時の個人情報を確認します。全画像のexact-set、監査record hash、P0/P1不在が必要です。申告した人の真正性や実作業を暗号学的に証明する仕組みではありません。fixture factoryはsynthetic_fixture専用です。

variantsは監査pass後に作ります。PNG/JPEG/WebPのローカル入力はjob直下のsource-mediaに置き、hashを固定します。上限24MiB・64M画素、静止画のみ。EXIF/XMP/orientationはcanonicalで除去・正規化し、配信画像も再検査します。A4のlocal_rasterは装飾写真・装飾図だけです。技術的事実の証拠となる画像、binary evidence transport、HEIF、AI画像、inline Demoは別途必要です。事実を示す画像を装飾として登録して回避しません。

## 決定的表紙

hero 2400×1260、social 1200×630です。既存logoと同梱Zen Kaku Gothic New 500 WOFF2をfontkit 2.0.4でglyph outlineへ変換し、既存Sharpでraster化します。外部サービス・system font fallback・生成画像APIは使いません。フォント/OFL・logo・実装・toolchain・タイトル/分類/日付へbindingを結びます。未対応文字、不可視制御文字、収まらないタイトルは切り捨てず停止します。実測UIや測定グラフを作りません。

fontkitはmedia-ingestだけの固定依存（MIT、lockfile integrity）です。同梱フォントのOFLを保持します。撤去時はこのrendererと専用fixtureを外し、既存native media runtimeや公開siteの依存を代替せず復旧します。

## 配信・保存計画

[固定profile](../../packages/content-contracts/src/profiles/article-media-targets-v1.ts)はXpotato-Serverのcommit ab9328c5a58082ac1ec268aa7d5901d838a6a474、cloudflare/production.yamlのSHA-256 da310213de6f2590ebfc249bad62f12e8960af4dce0bfa2ce135cc5ab0185fd8を根拠に、assets.xpotato.net、source/public/protectedのkey・storage class・cacheを表します。

実resourceの存在・権限・疎通・保存成功や操作許可を表しません。本人が正確なprofile hashをcandidate_planning_onlyとして確認するまで、public-origin/object-key/storageの未確認をblockerにします。bucket/provider IDや資格情報はSiteへ複製しません。public objectは保存後、記事deployより先にURLで閲覧可能になるため、監査と本人確認の対象です。

## 候補と参考preview

referenceなしのcandidate buildはhuman_localの内容/画像監査と確定計画が必要です。未来のpubDateはUTC日付でreadinessを停止し、参考previewにはfuture-publication-date blockerを表示します。条件成立後だけ既存forward transitionでCANDIDATE_READY→PREVIEW_VALIDATED→HUMAN_REVIEW_READYへ進みます。承認recordや保存receiptは生成しません。

--referenceは配信計画未確認や合成fixtureを確認する表示です。stateはMEDIA_READYのまま、candidateSha256=null、approvalEligible=false、productionEligible=falseです。targetSha256はprivate表示対象のhashであり、承認先ではありません。

本文・脚注・コード例・画像・SEO・権利・監査・planned URL・保存/protection計画・更新前後全文を同一bundleへ結びます。candidate MDXはdraft:falseの提案ですがworking.mdはdraft:trueのままです。画像・MDX・registry・計画・出力全fileとreceiptをhash/exact-setで照合し、本文やsrcsetも実HTMLから検査します。実端末・支援技術のアクセシビリティはmanual_required、実測performanceはnot_runです。

専用Astro projectはapps/site/.local配下だけに作り、実際のContentLayout・CSS・semantic module・脚注compilerを使います。通常content loaderを置換しません。通常buildへ候補環境変数が漏れた場合は停止します。未投入の権利/provenance配列を通常buildで必須化せず、cleanup-safe compact media検証APIは単独試験し、実export後のproduction接続はA6で扱います。

## 失効・配信・検証

本文・根拠・監査・原本/master/variants・frontmatter・権利・計画・render実装/lockfile/root・workspace package解決設定の変更で旧候補を失効させます。修正要求を別監査で上書きせずreviseで新attemptを作り、旧履歴を保持します。APIのimmutableファイルと前後比較を使いますが、敵対的OS同時書換えのatomic CASを保証しません。

previewは127.0.0.1のみ、exact Host/Origin、GET/HEAD、有限のHTML/CSS/script/font/登録画像だけです。job JSON・MDX・source・監査ファイルは配信しません。no-store/noindex、CSP connect/frame/worker/object noneを適用し、stale後は410。SIGINT/SIGTERMでは投機的TCP接続も閉じます。

visual:isolation:prepareは合成記事の画像処理と専用private buildを1回実行します。通常releaseのsite buildは従来の1回です。visual:isolation:checkは通常catalog/feed/search/distへ本文・registry・source・receipt・画像バイト・private Tailwind canaryが漏れないことを確認します。private成果物は公開CI artifactへuploadしません。Chromeのdesktop/mobile表示確認とnative Windows/macOS・Firefox/WebKit/iOSの実機受入れは区別します。
