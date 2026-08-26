# AGENTS.md

## Scope

このファイルは`Xpotato1024/xpotato-site`で作業するAI agent向けrepository-local instructionである。

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

- vNext documentation root: `docs/`
- old `doc/` / old README detail: legacy evidence
- ADR: decision history, not current SoT
- exact current/target rule: `docs/README.md`からcanonical docを辿る
- design-time current-site findings: `docs/migration/current-site-inventory-2026-08-26.md`; cutover時はfrozen tagから再inventoryする

## Content identity

- every vNext content entry has stable machine-generated lowercase UUIDv4 `ContentId`
- ContentId != slug / filepath / title / route
- route renameでもsame ContentIdを維持しredirectを同時に扱う
- Media Registry / provenance / Article updateはContentIdへbindする
- unknown/missing/duplicate ContentIdをsilent repairしない

## Frontend

- static HTML first
- production Node serverを標準にしない
- public site / AI authoring / media ingest / example verifierをworkspaceで分離
- normal UIはAstro
- Reactはstateful interactive islandのみ
- site-wide SPA / ClientRouterはdefaultにしない
- Tailwind 4 + CSS design tokens target
- CSS-in-JS runtimeを追加しない
- content-only routeへunintended hydrationを送らない

## Content

- MDX / Markdown authoring標準
- SEO boilerplate / archive / feed / media variantsを手管理しない
- frontmatterへR2 path / component path / hydration directiveを入れない
- taxonomyはstable registry ID
- unknown taxonomyをsilent fallback/createしない
- approved content module以外のad-hoc MDX componentを増やさない
- Tool MDXはReact importを持たずInteractive Module Registryからbindする
- raw WordPress HTMLをnew publishing pathにしない
- version-sensitive claimはcurrent sourceを確認
- benchmark / observed output / incident causeを観測なしに生成しない

## Citations

- AI authorはcitation URL/titleを自由生成しない
- Article Jobではfixed Source IDのlogical markerだけを使う
- executorがvalidated Source metadataからMarkdown footnoteへcompileする
- private source locatorをpublic citationへ漏らさない
- citationの存在だけでevidence requirementを満たしたとみなさない

## Technical examples

- AI-generated code / commandをhostで直接自動実行しない
- `packages/example-verifier`のversioned isolated profileだけがexecution boundary
- network default deny
- system / external mutation commandはautomatic execution default deny
- expected outputとobserved outputを区別
- observed outputはsandbox/evidence artifactへbind
- syntax passを「動作確認済み」と表現しない

## Article Job

- AIは`apps/site/src/content/`へ直接writeしない
- semantic AI = fixed request + exact Skill snapshot + response schema
- deterministic executor owns import / state / canonical artifact publication
- source discovery proposalとdeterministic source pinningを分離
- source / evidence / claimを分離
- author / auditor fresh context separation
- code example assessment後にcontent audit
- P0/P1残存でvisual/approvalへ進めない
- human approvalをAI/Skillへ委譲しない
- approval前にpublic R2 / canonical site contentをmutateしない
- approved mediaはrights revalidation後にcontent-addressed public R2へpublish
- public mediaはprotected recovery copy receipt成立後だけrepository export
- full Article Job workspaceはprivate。Gitへcompact provenanceだけ保存

## Visual/media

- Blog hero required; other collectionsのhero requirementを同一視しない
- AI-generated heroはconceptual/decorativeでtechnical evidenceではない
- factual diagram/chartはdeterministic sourceを優先できる
- photographic/raster mediaはR2-first
- photo / screenshot / raster project visual / photographic site hero / AI raster / gallery binaryをGitへcommitしない
- HEIC/HEIFをinputとして許容しprivate ingestでnormalize
- raw photoをpublic R2へ直接置かない
- public masterはcontent-addressed immutable R2 object
- same keyへdifferent bytes overwrite禁止
- Webで発見した画像をrights確認なしにR2へ再配布しない
- MDXはsite-owned R2 URLや`r2:/`を直書きせず`media:<asset-id>`を使用
- site buildはR2 master downloadを要求しない
- Blog hero/social cardはMedia Registryからroleで解決

small deterministic SVG / logo / favicon / icon / tiny texture / fixtureだけGit bundled asset候補。

## Discovery

- archives / pagination / RSS / relatedはcontent + registriesからbuild-time生成
- Pagefind indexはpost-build artifactでGit非管理
- Pagefind runtimeはinitially`/search/`だけでload
- normal article routeへsearch JSを送らない
- `/search/`はinitially noindex
- draft/noindex contentをsearch artifactへ漏らさない

## Preferred Skills

Article Job semantic stages:

- `$discover-article-sources`
- `$analyze-article-evidence`
- `$draft-japanese-technical-article`
- `$independent-article-audit`
- `$revise-article-from-audit`
- `$plan-article-visual`
- `$independent-visual-audit`

Manual support:

- `$japanese-technical-blog`
- `$site-content-publish`

### Routing

- production requestはexact stage Skill snapshotを固定
- architecture/ADR/runbookへarticle Skillを適用しない
- discovery/evidence/author/auditor/reviser/visual rolesを混ぜない
- source pinning / citation compile / media conversion / example execution / media publication/protectionはdeterministic or typed external tooling
- Skillはapproval / deploy / upload / protection credential / merge permissionを拡張しない

## vNext migration

- old mainをannotated Git tagでfreeze
- active mainにfull `archive/old-src`を置かない
- npm workspace構成へgreenfield rebuild
- frozen inventoryでcontent/route/media/taxonomy/interactive parityを検証
- migrated contentへstable ContentIdを割り当てる
- initial Blog category seedはinventoryに基づく`software / infrastructure / robotics`
- photographic/raster mediaはR2へ移しprotected-copy検証後にold active Git copyを削除
- parity後にold implementationをactive treeから削除

## Git/change

- direct main push禁止
- feature branch + PR
- material architecture changeはSoT/ADR同期
- framework migration / visual redesign / unrelated cleanupを巨大PRへ混ぜない
- existing user changeを無関係に上書きしない

## Validation

- repository-defined deterministic entrypointを使用
- schema / ContentId / taxonomy / citation / example / media rights/registry / route / provenanceを検査
- AI self-reportをvalidation resultとしない
- site buildのためにremote media bytesをfetchしない
- publication/protection/Cloudflare checksはseparate external integration gate

## Infrastructure boundary

site repo owns application/content/logical media/object-key/protection-receipt contract/build/route/delivery requirements。

`Xpotato-Server` owns Cloudflare account/zone/DNS/public/protected R2 resource/provider settings/credentials/retention/restore implementation。

provider account/bucket IDをsite repoのsecond SoTにしない。

## Human-facing language

human-facing docs / Issue / PR / articleは原則日本語。code/product/CLI/protocol/source titleは必要に応じて原文。

## Safety

- secret/token/credential/private infoをcommit/publishしない
- camera derivativeにGPS/private EXIFを残さない
- generated visualをfactual screenshot/benchmarkとmisrepresentしない
- rights unknown mediaを再配布しない
- destructive/external/production mutationはrequired approval / explicit scopeなしに行わない
