---
status: canonical
owner: operations
last_verified: 2026-10-15
canonical_for:
  - migration cohort and current publication discovery validation
---

# 移行集合と通常公開集合の検証

`phase8:evidence:check`（互換名 `phase8:check`）は現在のbuildをconsumeする検証です。記事数を44に固定せず、catalogから公開detail・indexable archive/RSS/related・検索対象を導出し、除外集合も検査します。空・13件目・25件目・同日順位・draft/noindex・ID/route衝突は人工fixtureで試験します。

移行の仮想archive/RSSとprivate previewは、`content-id-map-v1.json` と `content-materialization-v1.json` が一致する固定53 ContentId（うちBlog44）だけを選びます。移行Blogはdraft/hold必須で、仮想archiveの12/12/12/8を維持します。新規記事や検証用記事を移行集合へ追加しません。通常投稿の追加や更新は旧44記事の公開認可ではありません。

`phase8:preview` と `phase8:held-preview:check` は移行Blog44の隔離fixture専用です。通常の下書きpreviewではなく、job/private資料の公開経路にも使いません。

`phase8:write` / `phase8:capture:check` はそのrevisionのexact captureの作成・比較です。履歴のcommitted evidenceは変更せず、現在のpublication validator成功と同一視しません。過去captureの再現は対応するexact revisionとtoolchainで行います。新しい投稿集合やvalidator semanticsを過去のcaptureへ上書きして合格させません。

通常CIの `ci:final` は従来どおり `phase8:evidence:check` を実行します。移行manifestとそのhash、content本文、公開workflow、provider/publication gateはこの検証分離で変更しません。新規記事の画像・根拠・候補・承認・export検証は別工程です。

移行preview内の既存fenced-code copy enhancementは、静的code領域に結び付く単一defer scriptとして、既存性能予算（raw 6000 / gzip 2500）と依存・動的code禁止を検査し、`codeCopyAssets`へ分けて記録します。React/search assetの隔離と、content-onlyへのframework runtime禁止は維持します。
