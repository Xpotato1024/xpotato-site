# AGENTS.md

## Scope

このファイルは`Xpotato1024/xpotato-site`で作業するAI agent向けrepository-local instructionである。

恒常ルールを個別promptへ重複転記せず、`docs/README.md`のSource of Truth Mapとtaskに関係するcanonical documentを読んで判断する。

## Read first

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/product/product-context.md`
4. AI article作業なら`docs/product/ai-authoring-context.md`
5. taskに関係するarchitecture / contract / content / operations document
6. material decisionなら`docs/design/adr/`
7. related implementation / validation

product contextはframework / existing implementation preferenceより上位。

vNext採用前は`status: proposed`を尊重し、文書が存在することだけを理由にexisting codeを勝手にmigrationしない。

## Documentation boundary

- vNext current/target documentation rootは`docs/`
- old `doc/` / old README detailはlegacy / migration evidence
- `doc/`へnew current documentを追加しない
- ADRはdecision historyでcurrent SoTではない
- exact current/target ruleは`docs/README.md`からcanonical docを辿る

## Core frontend invariants

- static HTML first。通常routeはAstroでprerender
- Node.jsはbuild / authoring toolchain。production Node serverを標準にしない
- public siteとauthoring toolchainをnpm workspacesで分離
- normal UIはAstro
- Reactはstateful interactive islandのみ
- site-wide SPA / ClientRouterはdefaultにしない
- Tailwind CSS 4 + CSS design tokens target
- CSS-in-JS runtimeを追加しない
- performance / accessibilityはarchitecture constraint

## Content invariants

- MDX / Markdownをauthoring標準とする
- SEO boilerplate、archive membership、media variantを手作業で個別管理させない
- frontmatterにmedia path / React component path / hydration directiveを入れない
- unknown taxonomyをsilent fallback / silent createしない
- taxonomyはstable registry ID
- approved content module以外のad-hoc componentを記事ごとに増やさない
- Tool MDXはReact等を直接importせずInteractive Module Registryからprimary moduleを解決する
- raw WordPress HTML / `LegacyHtml`をnew publishing pathにしない
- legacy URL metadataを記録しただけでredirect activeとみなさない
- current version / provider behavior等の変動claimはcurrent sourceを確認
- benchmark / log / incident causeを観測なしに生成しない

## Article Job invariants

- AIは`apps/site/src/content/`へ直接writeしない
- semantic AI inputはfixed request + Skill snapshot + response schema
- deterministic executorがimport / validation / artifact publication / state transitionを所有
- source / evidence / article claimを分離
- author / auditorはfresh contextで分離
- P0/P1が残るarticleをvisual / approvalへ進めない
- AI-generated heroはconceptual / decorativeでtechnical evidenceではない
- human approvalをAI / Skillへ委譲しない
- approval前にpublic R2 / canonical site contentをmutateしない
- approved candidate mediaをR2へpublish・verifyした後だけrepository exportできる

## Media invariants

- content mediaは**R2-first**
- article photo / screenshot / AI hero / gallery binaryをGitへcommitしない
- iPhone HEIC / HEIFをfirst-class author inputとして許容
- raw HEIC / original photoはpublic R2へ直接置かない
- media ingestでorientation / sRGB / private metadata / sizeをnormalize
- ingest outputは`.local/` private stagingでありGit/R2へ直接publishしない
- public web masterはcontent-addressed immutable R2 object
- same R2 keyへのdifferent bytes overwrite禁止
- MDXへsite-owned R2 URLを直書きせず`media:<asset-id>`等のlogical referenceを使う
- normal site buildはR2 master downloadを要求しない。dimensions / object metadataはMedia Registryを使う
- published Blogはexactly one active hero + social cardをregistryで解決する
- raw camera mediaとAI-generated mediaはprivacy / provenance policyを分ける

small favicon / logo / UI icon / textual SVG / fixtureだけGit bundled asset候補。

## Preferred Skills

Article Job production stages:

- `$analyze-article-evidence`
- `$draft-japanese-technical-article`
- `$independent-article-audit`
- `$revise-article-from-audit`
- `$plan-article-visual`
- `$independent-visual-audit`

Manual support:

- `$japanese-technical-blog`
- `$site-content-publish`

### Skill routing

- production requestはexact stage Skill snapshotを固定しfuzzy auto-chainしない
- architecture / ADR / runbook / READMEへarticle Skillを自動適用しない
- evidence / author / auditor / reviser / planner / visual auditorを混ぜない
- camera decode/normalizeはdeterministic `media-ingest`
- public R2 uploadはSkill permissionではなくapproval-gated deterministic operation
- Skillはproduction deploy / credential / merge permissionを拡張しない

## vNext implementation migration

- old mainをimmutable annotated Git tagでfreeze
- full old sourceをactive `main/archive/`へcopyしない
- npm workspace構成へactive treeを再構築
- migration inventoryでcontent / route / media / taxonomy / interactive parityを検証
- new site parity後にold implementationをactive treeから削除
- history rewrite不要

## Git and change policy

- `main`へ直接commit / pushしない
- feature branch + PR
- material architecture changeはcanonical docs + ADR同期
- framework migration / visual redesign / unrelated cleanupを巨大PRへ混ぜない
- existing user changeを無関係に上書きしない

## Validation

implementationではrepository-defined deterministic entrypointを使用する。

content-onlyでもschema / taxonomy / media registry / route / redirectを検査する。

AI self-reportをvalidation resultとして扱わない。

R2 network availability検査はsite HTML generationと分離し、buildのためにremote media bytesをfetchしない。

## Infrastructure boundary

`xpotato-site` owns:

- application / content
- media logical identity / object-key semantics
- build / route / delivery requirements
- Article Job publication manifest

`Xpotato1024/Xpotato-Server` owns:

- Cloudflare account / zone / DNS
- R2 bucket resource / provider state
- zone-level Cache / Compression Rules
- infrastructure credentials / secret handling

provider account / bucket IDをsite repoの第二SoTにしない。

## Human-facing language

human-facing docs / Issue / PR / articleは原則日本語。formal product name / code / CLI / protocol literal / source titleは必要に応じて原文維持。

## Safety

- secret / token / credential / private-only informationをcommit / publishしない
- public articleは公開可能なsourceだけを使用
- camera derivativeにEXIF GPSを残さない
- generated visualをfactual screenshot/benchmarkとしてmisrepresentしない
- destructive migration / external upload / production mutationはrequired approval / explicit scopeなしに行わない
