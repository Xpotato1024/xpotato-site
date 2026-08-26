# AGENTS.md

## Scope

`Xpotato1024/xpotato-site`で作業するAI agent向けrepository-local instruction。

恒常ルールを個別promptへ複製せず、`docs/README.md`のSoT Mapからtaskに必要なcanonical documentを読む。

## Read first

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/product/product-context.md`
4. AI article taskなら`docs/product/ai-authoring-context.md`
5. relevant architecture / contract / operations docs
6. material decisionなら`docs/design/adr/`
7. implementation / validation

product / authoring goalはframework preferenceやlegacy implementationより上位。

`status: proposed`のvNext docは設計案であり、存在するだけでexisting implementationを勝手にmigrationしない。

## Documentation boundary

- vNext: `docs/`
- old `doc/` / old README detail: legacy evidence
- ADR: decision history, not current SoT
- design-time inventory: `docs/migration/current-site-inventory-2026-08-26.md`
- cutover時はfrozen legacy tagから再inventory

## Content identity

- every vNext content has stable lowercase UUIDv4 `ContentId`
- ContentId != slug/file/title/route
- route renameでもsame ContentId + redirect
- Media Registry/provenance/updateはContentIdへbind
- unknown/missing/duplicate IDをsilent repairしない

## Frontend

- static HTML first
- production Node serverなし
- public site / AI authoring / media processing / example verifierをworkspace分離
- normal UI=Astro
- React=stateful interactive island only
- no site-wide SPA/ClientRouter
- Tailwind 4 + CSS tokens
- content-only routeへunintended hydrationなし

## Content

- MDX/Markdown standard
- SEO/archive/feed/media variantsを手管理しない
- frontmatterへR2/component/hydration pathを入れない
- taxonomy=stable registry ID
- unknown taxonomy silent fallback/create禁止
- approved content module以外のad-hoc MDX componentを増やさない
- Tool MDXはReact importを持たずInteractive Module Registryからbind
- raw WordPress HTMLをnew pathにしない
- version-sensitive claimはcurrent source確認
- benchmark/observed output/causeを観測なしに生成しない

## Citations

- AI authorはcitation URL/titleを自由生成しない
- fixed Source ID logical markerだけを使う
- executorがvalidated Source metadataからfootnoteへcompile
- private locatorをpublic citationへ漏らさない

## Technical examples

- AI-generated code/commandをhostで直接自動実行しない
- `packages/example-verifier` only execution boundary
- exact profiles: `docs/operations/technical-example-profiles.md`
- network default deny / no credentials / bounded resources
- initial sandbox execution: self-contained Python / Node / SQLite only
- Bash/PowerShell/TypeScript/configはinitially parse/typecheck中心
- system/admin/cloud/Docker/Git remote mutationはautomatic execution禁止
- expected outputとobserved outputを区別
- syntax passを「動作確認済み」としない

## Article Job

- AIは`apps/site/src/content/`へ直接writeしない
- semantic AI = fixed request + exact Skill snapshot + response schema
- deterministic executor owns import/state/canonical artifact publication
- source discovery proposalとsource pinningを分離
- source/evidence/claimを分離
- author/auditor fresh context
- code example assessment後にcontent audit
- P0/P1残存でvisual/approvalへ進めない
- human approvalをAI/Skillへ委譲しない
- approval前にcanonical site/private-source/public/protected R2をmutateしない
- approved canonical mediaをprivate source-mediaへstore/verify
- then public delivery master/variants publish/verify
- then protected exact-byte copy receipt
- only then repository export
- full Article Job workspace private; Gitへcompact provenance only

## Visual/media

- Blog hero required; other collection optionalityを維持
- AI hero=conceptual/decorative, not evidence
- factual diagram/chartはdeterministic/evidence source優先
- photo/screenshot/raster project/site hero/AI raster/galleryをGitへcommitしない
- HEIC/HEIF input allowed
- raw camera originalはsite long-term R2 storageへそのまま保存しない
- ingest -> privacy-normalized lossless canonical master
- approved canonical master -> private source-media R2
- visual audit後にresponsive variants pre-generate
- public delivery master/variants -> content-addressed immutable R2
- exact public bytes -> separate private protected-media R2
- Cloudflare Images baseline dependency禁止
- same key/different bytes overwrite禁止
- rights unknown Web media再配布禁止
- MDXは`media:<asset-id>`; direct site-owned R2 URL/`r2:/`禁止
- site buildはremote media download不要

small deterministic SVG/logo/favicon/icon/tiny texture/fixtureだけGit bundled candidate。

## Discovery/search

- archives/pagination/RSS/relatedはbuild-time deterministic
- initial pagination 12、RSS 20 summary、related max4
- search=MiniSearch 7.2.0 + repository-owned `xpotato-ja-tech-bigram-v1`
- build/queryでsame tokenizer sourceを使う
- Japanese/CJK primary bigram; generic fuzzy fallbackなし
- serialized search indexはbuild artifactでGit非管理
- MiniSearch/search runtimeは`/search/`だけ
- normal article routeへsearch JSなし
- `/search/` noindex
- draft/noindexをsearch artifactへ漏らさない

## Preferred Skills

Article Job semantic stages:

- `$discover-article-sources`
- `$analyze-article-evidence`
- `$draft-japanese-technical-article`
- `$independent-article-audit`
- `$revise-article-from-audit`
- `$plan-article-visual`
- `$independent-visual-audit`

Manual:

- `$japanese-technical-blog`
- `$site-content-publish`

Skillはapproval/deploy/upload/credential/merge permissionを拡張しない。

## vNext migration

- old mainをannotated Git tagでfreeze
- active mainにfull `archive/old-src`なし
- npm workspaceへgreenfield rebuild
- frozen inventoryでcontent/route/media/taxonomy/interactive parity
- stable ContentId割当
- initial Blog categories=`software / infrastructure / robotics`
- raster mediaはcanonical source/public/protected planesへmigrationしてからold active Git copyを削除
- parity後にold implementation削除

## Git/change

- direct main push禁止
- feature branch + PR
- material architecture changeはSoT/ADR同期
- framework migration/visual redesign/unrelated cleanupを巨大PRへ混ぜない
- user changesを無関係に上書きしない

## Cloudflare/control plane

- production site CI/CD=GitHub Actions
- deploy=Wrangler
- Workers Builds/Pages dashboard configをproduction SoTにしない
- zone/DNS/Worker domain/R2 config/Rules=`Xpotato-Server` OpenTofu/API SoT
- source/public/protected media resourcesもinfra owner
- normal configurationでDashboard clickを要求しない
- Dashboard=bootstrap/billing/account recovery/break-glass/true provider-gap only
- R2 config adminはoperator-held ephemeral; CP/site CIへ常設しない
- provider IDsをcontent/media contractへ埋め込まない

## Validation

- repository-defined deterministic entrypoint
- schema/ContentId/taxonomy/citation/example/media/search/route/provenance validation
- AI self-reportをvalidation resultにしない
- buildのためにremote media fetchしない
- external media/provider checksはseparate integration gate

## Infrastructure boundary

site repo owns application/content/media semantic contracts/build/route/delivery/search requirements。

`Xpotato-Server` owns Cloudflare account/zone/DNS/Worker domain/private-source/public/protected R2 resources/provider settings/credentials/restore implementation。

provider account/bucket IDをsite repoのsecond SoTにしない。

## Human-facing language

human-facing docs / Issue / PR / articleは原則日本語。identifier/path/CLI/source titleは必要に応じ原文。

## Safety

- secret/token/private infoをcommit/publishしない
- camera derivative/canonical sourceにGPS/private EXIFを残さない
- generated visualをfactual screenshot/benchmarkとmisrepresentしない
- rights unknown mediaを再配布しない
- destructive/external/production mutationはrequired approval / explicit scopeなしに行わない
