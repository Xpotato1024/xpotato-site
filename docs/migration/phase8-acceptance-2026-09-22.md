---
status: proposed
owner: migration
last_verified: 2026-09-22
canonical_for:
  - Phase 8 route and discovery readiness candidate
  - Phase 9 provider redirect requirement handoff
---

# Phase 8 Route / SEO / Discovery / Search parity

## 状態

検証中。Repository-side gate、exact regeneration、fresh audit、hosted Linux exact-head CIが完了するまでREADY FOR REVIEWとは扱わない。

開始条件はPR #53のmergeで確認した。Base mainは`36de35114d9a0589656cd90ff140f42287928053`。
Frozen authorityはtag `legacy-pre-vnext-2026-08-28`、tag object `8503f5a50a5fb3d27a02422da0b50dc66c818b02`、peeled commit `927d105713561309fc5e2374396f86646b5aeb2a`。

## Route inventoryを先に固定

実装前に既存generatorでfrozen Git objectから再列挙し、inventory payload `9151be197d9e48a12297d45dfdd2a72a15cf9ce16f143fdc16b60e5345d37493`とaccepted build endpoint digest `3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92`への一致を確認した。今回legacy buildを再実行したという意味ではなく、Phase 1のaccepted build evidenceに結び付けたexact inventory regenerationである。

72 identityは69 static endpointと3 WordPress query identityからなる。各identityのdisposition、ContentId、canonical候補、hold、redirect requirement、根拠は`phase8-route-discovery-readiness-v1.json`から再生成する。Mutable current `src/`はauthorityにしない。

候補はsame 62、application_redirect 6、provider_redirect 3、not_public 1、retired 0。`/404.html`はnot_publicでありnoindexのnot-found document。`/pages/`と`/projects/`の一覧は維持する。Frozen legacyにtag archiveと`/page/N/`のendpointは存在しない。

Application redirectの唯一のSoTは`apps/site/src/content-registry/redirects.ts`。Known compatibility 2件に加え、旧Blog category `diary / infra / network`は`/blog/`へ集約し、旧Tool category `calculation`は`/tools/`へ集約する。

旧`diary`のpublic archiveはraw categoryの`diary`だけでなく、legacy fallbackでsoftware記事を含む。Phase 5のraw taxonomy mappingをそのままURLの転送先に使うと誤分類になる。Blog全体を転送先にすることで旧memberを欠落させず、hold中の未生成taxonomy routeを転送先にしない。新しいcategory/tag/year archiveは既存のaccepted taxonomy profileから生成する。この選択はURL dispositionとしてPRで明示reviewする。`network` tagの`archive=false`を変えたり、架空のtag archiveを生成したりしない。

## Real 301と責務

Astro static outputの`Astro.redirect()`はHTTP statusを持つ301ではなくmeta refreshになる。[Astro API reference](https://docs.astro.build/en/reference/api-reference/)

このためpath registryからAstro build hookで`dist/_redirects`を生成し、既存のWorkers Static Assets servingに渡す。`_redirects`はWorkers Static Assetsがnativeで解釈するapplication deploy artifactであり、Redirect RuleやDNS設定ではない。[Workers Static Assets redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)

Readiness checkはpinned Wranglerの`dev --local`をloopbackだけで起動し、実際のgenerated artifactに対してGET/HEAD 301、Location、転送先200、旧content body未配信、404 responseを検査する。Astro previewの200応答やsource記述だけを301の証拠にしない。SSR/server runtime/adapterの追加は不要である。ローカル結果はproduction activation/read-backを証明しない。

Query requirementsはfrozen legacyの`legacyPath`を再確認し、Phase 4のContentIdと現在canonical routeへbindする。`/?p=34`、`/?p=693`、`/?p=811`のexact requirementはmanifest内にある。Application `_redirects`にはquery ruleを出力しない。Provider ownerは`Xpotato-Server`であり、Phase 9でaccepted counterpartと明示権限が必要である。

## Publication holdとdiscovery

44 migrated Blogと既存draft fixtureのdraftは変更しない。候補canonical、archive、RSS、related/search eligibilityはoffline evidenceとしてのみ計算する。Media/provider persistence未完のBlogをpublishableとは扱わない。

通常buildのsitemapはcurrent indexable self-canonical HTML setと完全一致し、draft/noindex/404/search/redirect sourceを除外する。robotsのsitemap originも検査する。404は`not_found_handling=404-page`とローカルHTTP404を照合し、固定`/404.html` canonicalが通常contentと衝突しないことを確認する。

Blog/Notesは12件/page、決定的なpubDate降順とContentId tie-break、page1重複なし、empty taxonomy/out-of-range pageなし。Offline migrated Blog rootは12/12/12/8の4page候補となる。RSSはBlog20件上限のsummary、stable ContentId GUID、canonical link、valid XML。通常buildではheld Blogを含めない。

Relatedはmax4、minimum4、weights 1/2/4/2の既存profileを維持する。Primary taxonomy namespaceを分け、retired/unknown tagを加点せず、score同点時だけrecencyとContentIdを使う。ADR-0031のlegacy top-3 reproduction semanticsは適用しない。

MiniSearch 7.2.0、`xpotato-ja-tech-bigram-v1`、fuzzy offは維持する。日本語/カタカナ/ASCII/mixed/punctuation/caseと`新幹線`対generic `新...`は、HTML searchable regionからserialized indexを作成しruntimeと同じload/queryを通してexact ContentId/route/titleを検査する。Synthetic fixtureはproduction indexと別である。

Production全HTMLのclient graphと、held Blogのprivate fixture buildを測定する。Fixtureは通常Blog詳細componentと既存held contentを使い、noindexの独立temp outputだけへ生成する。Production draft解除、fixtureの通常build混入、React/Search runtimeの不要な共有を許さない。

## 検証とaudit

Local `npm run phase8:check`はPASS（29 tests、typecheck、Astro check、build/static validation、Phase 7 regression、private fixture、local GET/HEAD 301、exact regeneration）。Current sitemapは17 URL、canonical ContentId候補は56（holdを含む）、通常RSSは0 item、offline candidate RSSは20 itemのvalid XML。Windows `npm run ci`はPhase 6の`Committed Phase 6 local processing manifest differs from exact regeneration`で停止したためfull CI PASSとは扱わない。Implementation candidate、fresh audit verdict、hosted検証結果は別途exact SHAへ固定する。`npm ci`、`npm run ci`、`npm run phase8:check`、`git diff --check`を実行する。`XPOTATO_PHASE8_TEMP_ROOT`には絶対task temp pathを指定し、private fixtureとlocal serving stateを格納する。Hosted Linux full CIとdedicated Phase 8 workflowはexact headで必須である。

## Phase 9 handoff / safety

`persistentMutationAuthorized=false`とdeploy workflowの`if: ${{ false }}`を維持する。Cloudflare API/rules、R2、DNS、Worker custom domain、Wrangler deploy、cutover、protected restore、Article Job production activation、legacy deletionはNOT RUN。

次phaseへ渡すのはprovider-independent redirect requirementとrepository-side parity evidenceである。Provider activation、hold解除、production read-back、media recovery、rollback/cutoverのacceptanceは別gateとして残る。このcandidateはPhase 9権限を生成しない。
