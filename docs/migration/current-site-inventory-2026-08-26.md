---
status: supporting
owner: migration
last_verified: 2026-08-26
canonical_for: []
source_revision: 927d105713561309fc5e2374396f86646b5aeb2a
---

# Current Site Inventory — 2026-08-26

vNext設計をcurrent dataへ束縛するためのsupporting migration evidence。

current architectureのSoTではない。implementation cutover時はfrozen legacy tagからmachine inventoryを再生成し、このbaselineとの差分をreviewする。

## Scope

調査対象:

- `Xpotato1024/xpotato-site` main `927d105713561309fc5e2374396f86646b5aeb2a`
- current public `xpotato.net`
- `Xpotato1024/Xpotato-Server` Cloudflare current / desired inventory

## Content counts

| Collection | Current/published |
|---|---:|
| Blog | 44 |
| Projects | 6 |
| Notes | 1 |
| Tools | 1 |
| Pages | 1 |

Pagesは`about`。Homeは独立content collectionではなくcollection集約面。

## Blog taxonomy drift

current public category display:

- infra 12
- network 1
- diary 31
- app 0

raw contentでは31 Blog entriesが`category: "devlog"`。

current `src/lib/blog.ts`は`infra | network | app | diary`だけをknown categoryとし、unknown categoryをtagsでheuristic再分類後、最後は`diary`へfallbackする。

そのためcurrent `diary`はsemantic diary categoryではなく、主にGale software development logがfallbackした結果。

### vNext initial Blog category seed

current 44件を:

| Category | Count |
|---|---:|
| `software` | 31 |
| `infrastructure` | 12 |
| `robotics` | 1 |

へ初期mappingできる。

- raw `devlog` -> topical `software`; devlog/build-log semanticsはArticle Job modeへ
- current network 1件 -> infrastructure + network/ssh/vps tags
- vibration-robot -> robotics
- current published 0件のappはseedしない

migration fixtureで44件がexactly once partitionされることを検証する。

## Tag / technology observations

currentはfree-form tags + Project free-form technologiesで、normalization needがある。

confirmed examples:

- `TypeScript` / `typescript`
- `Tailwind CSS` / `tailwind`
- `programing`
- `webサーバー`
- `univ`

frequent/topic clusters:

- software: gale, rust, gpu, wgpu, sqlite, performance, benchmark, codex, python, go, typescript, react, docker
- AI/RAG: rag, anythingllm, qdrant, vllm, qwen, tei, rerank
- platform: windows, wsl, wsl2, homelab, storage, ssh, vps, conoha-vps
- web/project: astro, mdx, firebase, firestore, postgresql, tailwind
- document/data: pandoc, latex, powershell, pandas, matplotlib

exact initial tag registryはcutover tagからmachine extractionし、active/alias/merge/retire/metadata-onlyをhuman reviewする。

## Notes / Tool taxonomy seed

- Notes current subject: `infrastructure` -> initial active seed
- Tool current category: `calculation` -> initial active seed
- legacy codeに定義されるunused `documents` / `utility`は先行seedしない

## Project metadata

Projects 6件。

current frontmatterにはpresentation/storage concernが混在:

- summary
- showRepoLink
- confidential
- coverImage / overviewImage / overviewPosition
- technologies

vNextではdescription / links / sourceAvailability / Media Registry / technology tagsへ分離する。

## Interactive runtime

user-facing React interactive implementationはcurrent inventory上1件:

- `PrimeFactorizer.tsx`
- Tool content `prime-factorizer.mdx`
- current hydration `client:visible`

vNext golden mapping:

```text
prime-factorizer ContentId
 -> Interactive Module Registry `prime-factorizer`
 -> framework React
 -> hydration visible
```

current `AdSlot.astro`はplaceholderでthird-party ad runtimeではない。

## Route baseline

primary families:

- `/`
- `/blog/` + 44 article routes
- current Blog category routes
- `/projects/` + 6 project routes
- `/notes/` + 1 note route
- `/tools/` + 1 tool route
- `/tools/category/calculation/`
- `/about/`
- `/pages/`
- 404 handling

### Current path compatibility pages

- `/blog/prime-factorizer/` -> `/tools/prime-factorizer/`
- `/blog/category/tools/` -> `/tools/`

current mechanismはmeta refresh + canonical/noindex。vNextはreal application 301 redirectへ昇格。

### Current WordPress query identities

current code searchで`legacyPath`を持つpublished contentは3件:

| Legacy | Target content |
|---|---|
| `/?p=34` | PrimeFactorizer |
| `/?p=693` | vibration-robot |
| `/?p=811` | ConoHa SSH article |

vNextではContentId割当後にprovider-level query redirect requirementへ変換し、actual Cloudflare ruleは`Xpotato-Server` owner。

`/pages/`をretireする場合もexplicit route disposition必須。

## Git media inventory

known `public/images` + `public/wp-content/uploads` media total: **4,559,586 bytes**。

known photographic/raster subset: **約4,539,337 bytes**。

notable raster:

- `xpotato-site-overview.png`: 1,220,425 B
- `hero-workshop-stage.jpg`: 760,808 B
- `img_4844.jpg`: 570,539 B
- `syu-katsu-management-overview.png`: 480,461 B
- `img_7.jpg`: 449,894 B
- `meidaisai-overview.png`: 392,797 B
- `img_8.png`: 339,366 B
- `img_9.png`: 317,268 B

small deterministic SVG assetsは数KB級。

### vNext media placement decision

R2-first:

- camera photo
- screenshot
- raster article/project visual
- photographic/raster site hero/background
- AI-generated raster
- gallery media

Git candidate:

- small deterministic SVG
- logo/favicon/icon
- tiny design-system texture
- synthetic fixture

site chrome用途でもphotographic rasterはR2-first。

## Existing R2 use

current site config:

- public asset origin: `https://assets.xpotato.net`
- `r2:/...` logical resolver

content direct R2 reference confirmed:

- `vibration-robot` hero: `r2:/blog/my-first-post/GDCH3152.JPG`

vNextではlegacy semantic pathを継承せず:

```text
legacy object
 -> normalize + rights/provenance review
 -> content-addressed public object
 -> protected recovery copy
 -> Media Registry semantic asset ID
```

へ移行する。

## Cloudflare / deployment

current repo has Workers Static Assets-compatible `wrangler.jsonc`:

- app name `xpotato-site`
- static directory `./dist`
- `not_found_handling: 404-page`

current mainには`.github/workflows` directoryなし。

current `Xpotato-Server` inventory:

- authoritative `xpotato.net` zone active
- website-public-binary-assets R2 resource present

current desired backup architectureにはwebsite public media protection classが明示されていない。

vNext R2-first cutover前にinfra側へprotected website-media desired stateが必要。

site側設計は現在:

```text
MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

をhard gateとする。

## Framework/toolchain debt

current baseline:

- Astro 5.18.1
- React 18
- Tailwind CSS 3.4
- deprecated `@astrojs/tailwind`
- old `type: "content"` Content Collections
- no npm workspace split
- no repository CI workflow

current Wrangler deployment conceptは再利用可能だが、implementation/code structureはgreenfield rebuild対象。

## Legacy HTML debt

representative LegacyHtml content:

- `vibration-robot`
- ConoHa SSH article

`vibration-robot`はLegacyHtml + local image + legacy R2 hero + WordPress query URLを同時に持つためmigration fixtureとして重要。

## Golden migration fixtures

1. `gale-storage-backend-compare`
   - clean MDX / software taxonomy / benchmark
2. `codex-sqlite-write-amplification-mitigation`
   - investigation / external source / observed metrics
3. `vibration-robot`
   - LegacyHtml / local+r2 media / robotics / query redirect
4. `2025-10-06`
   - LegacyHtml / screenshot / CLI / infrastructure mapping
5. `prime-factorizer`
   - Tool / React island
6. `xpotato-site` Project
   - project metadata cleanup / large raster to R2 / small SVG candidate

## Decisions closed by inventory

- Blog initial categories = software / infrastructure / robotics
- devlog is not topical category
- network is initially tag/topic, not top-level Blog category
- Notes subject seed = infrastructure
- Tool category seed = calculation
- photographic/raster media = R2-first even for site chrome
- compatibility meta-refresh pages -> 301
- current provider-query redirect baseline = 3 WordPress IDs
- PrimeFactorizer = initial interactive migration fixture
- public R2 media requires protected recovery copy before Git export

## Still generated/measured at implementation

- exact full tag registry + aliases
- ContentId allocation for all entries
- exact semantic media asset IDs
- cutover-tag delta from this current baseline
- performance/client bundle baseline and budgets
- media encode/delivery numerical profiles
- AI/provider profiles and budgets
- protected-media exact infra retention/lock values
- Pagefind/RSS/related exact profile values
