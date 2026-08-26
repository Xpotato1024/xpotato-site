---
status: supporting
owner: migration
last_verified: 2026-08-26
canonical_for: []
source_revision: 927d105713561309fc5e2374396f86646b5aeb2a
---

# Current Site Inventory — 2026-08-26

この文書はvNext設計を実データへ束縛するためのmigration evidenceであり、current architectureのSoTではない。

調査対象:

- `Xpotato1024/xpotato-site` main `927d105713561309fc5e2374396f86646b5aeb2a`
- 現在公開されている `xpotato.net`
- `Xpotato1024/Xpotato-Server` のCloudflare current / desired inventory

## 1. Published content inventory

current mainと公開面から確認できるcollection件数:

| Collection | Published/current entries | Notes |
|---|---:|---|
| Blog | 44 | public Blogも44件 |
| Projects | 6 | current directoryも6 files |
| Notes | 1 | `wordpress-migration-playbook` |
| Tools | 1 | `prime-factorizer` |
| Pages | 1 | `about`。root route `/about/`で公開 |

Homeは独立content collectionではなくcollectionの集約面。

### Blog raw category reality

current public UI:

- `infra`: 12 rendered
- `network`: 1 rendered
- `diary`: 31 rendered
- `app`: 0 rendered

しかしraw frontmatterとrendererは一致していない。

`src/lib/blog.ts`は認識categoryを`infra | network | app | diary`に限定し、未知categoryをtagsから再分類して最後は`diary`へfallbackする。

一方、31件のBlog entryがraw frontmatterで`category: "devlog"`を持つ。内訳はGale開発記事群とCodex SQLite調査記事である。`devlog`はrendererのknown categoryではないため、Codex記事は`windows` tagによって`infra`へ、Gale記事群は最終fallbackで`diary`へ分類される。

その結果、public `diary` 31件は「日記31件」を意味しない。ほぼ全てがsoftware development logであり、`diary`をvNext topical categoryとして引き継ぐのは不適切。

### Evidence-based vNext Blog category migration

current 44 entriesは初期migrationで次のbroad topicへ再分類する。

| vNext Category ID | Label | Legacy mapping baseline | Current-count baseline |
|---|---|---|---:|
| `software` | ソフトウェア | raw `devlog` 31件 | 31 |
| `infrastructure` | インフラ | current infra family 11件 + ConoHa network 1件 | 12 |
| `robotics` | ロボティクス | `vibration-robot` | 1 |

`devlog`はcategoryではなくArticle Job `mode=build_log`等へ意味を移す。

`network`はcurrent 1件だけのため初期top-level Blog categoryにはせず、`network` / `ssh` / `vps`等のtagで表現する。

`app`はcurrent public entryが0件で、初期category registryには採用しない。softwareへ統合する。

この3 categoryでcurrent 44件をlosslessにpartitionできることをmigration fixtureで検証する。

## 2. Taxonomy observations

current taxonomyはfree-form strings + heuristic fallbackで、次の問題がある。

- category schemaが`string`でunknown valueを許可
- `devlog`のようにcontentで使われるがrendererが知らない値が存在
- `ssh`がinfra/network両tag setに含まれ、precedenceでinfraが先勝ち
- tagとtechnology stackが別free-form listで重複
- `programing`、`webサーバー`、`univ`等、alias/typo/one-off候補がある
- `TypeScript` vs `typescript`、`Tailwind CSS` vs `tailwind`のような表示名とIDが別管理されていない

migrationではraw termをそのままregistry化せず、machine inventoryからfrequencyを出して:

- canonical active tag
- alias
- merge
- metadata-only / archive-enabled
- retired

を決める。

初期high-value technology/topic clusterとして少なくとも現行contentから次が確認できる。

- software: `gale`, `rust`, `gpu`, `wgpu`, `sqlite`, `performance`, `benchmark`, `codex`, `python`, `go`, `typescript`, `react`, `docker`
- AI/RAG: `rag`, `anythingllm`, `qdrant`, `vllm`, `qwen`, `tei`, `rerank`
- platform/infra: `windows`, `wsl`, `wsl2`, `homelab`, `storage`, `ssh`, `vps`, `conoha-vps`
- web/project: `astro`, `mdx`, `firebase`, `firestore`, `postgresql`, `tailwind`
- document/data: `pandoc`, `latex`, `powershell`, `pandas`, `matplotlib`

exact initial tag recordsは手書きdocsではなくmigration inventory generator outputからregistryを生成・reviewする。

## 3. Notes / Tools taxonomy

Notesは1件のみでcurrent subject=`infrastructure`。初期`NoteSubjectRegistry`は過剰分割せず、この値をactive seedとしてよい。

Toolsは1件のみでcategory=`calculation`。current codeには`calculation | documents | utility`の3 categoryが定義されるが、published entryはcalculation 1件だけ。

初期vNext ToolCategory registryは:

- `calculation` active
- `documents`, `utility`はentryが生じるまでregistryへ先行追加しなくてもよい

とする。unknown category fallbackを廃止する。

## 4. Project metadata observations

Projectsは6件。

current schemaにはpresentation / storage concernがfrontmatterへ混ざっている:

- `summary`
- `showRepoLink`
- `confidential`
- `coverImage`
- `overviewImage`
- `overviewPosition`
- free-form `technologies`

vNext contractでこれらをdescription / links / sourceAvailability / Media Registry / technology-tag registryへ分離する判断はcurrent dataでも妥当。

observed technology examples:

- Xpotato Site: Astro / TypeScript / Tailwind CSS / MDX
- repo-audit: Python / Go / Docker
- Meidaisai MAC: TypeScript / Firebase / Firestore / Tailwind CSS
- 就活マネジメント: Go / React / TypeScript / PostgreSQL
- CSV2G: Python / pandas / matplotlib / tkinter
- Pandocker-X: Docker / PowerShell / Pandoc / LuaLaTeX

## 5. Interactive runtime inventory

user-facing React interactive implementationとして確認できるものは1件:

- `src/components/app/PrimeFactorizer.tsx`
- Tool content: `src/content/tools/prime-factorizer.mdx`
- current hydration: `client:visible`

current MDXがReact source pathとhydration directiveを直接所有するため、vNextではInteractive Module Registryへ移す。

initial migration mapping:

```text
content: prime-factorizer
  -> stable ContentId
  -> interactive module: prime-factorizer
  -> framework: react
  -> hydration: visible
```

current `src/components/ads/AdSlot.astro`はplaceholderだけでthird-party ad runtimeではない。広告/analytics scriptをmigration dependencyとして持ち込まない。

## 6. Route inventory

primary route families:

- `/`
- `/blog/`
- `/blog/<slug>/` x44
- `/blog/category/<category>/` — current non-empty: infra / network / diary
- `/projects/`
- `/projects/<slug>/` x6
- `/notes/`
- `/notes/<slug>/` x1
- `/tools/`
- `/tools/<slug>/` x1
- `/tools/category/calculation/`
- `/about/`
- `/pages/`
- `/404.html` / Workers Static Assets 404 handling

compatibility HTML routes:

- `/blog/prime-factorizer/` -> meta refresh to `/tools/prime-factorizer/`
- `/blog/category/tools/` -> meta refresh to `/tools/`

これらはvNextでmeta-refresh pageとして再実装せず、application path 301 redirectへ昇格する。

WordPress `/?p=...` legacy identityはfrontmatterに複数存在し、query-based redirectなのでprovider-level redirect inventoryへ送る。

`/pages/`はcurrent固定ページ一覧である。vNextで情報価値が低ければretire可能だが、route dispositionを明示してから削除する。

## 7. Git media inventory

current `public/`の既知media:

### Project media

8 files, 2,110,698 bytes total。

raster PNG:

- `meidaisai-overview.png`: 392,797 B
- `syu-katsu-management-overview.png`: 480,461 B
- `xpotato-site-overview.png`: 1,220,425 B

small deterministic SVG:

- project cover SVG x4
- repo-audit overview SVG x1

### Tool media

- `prime-factorizer-cover.svg`: 2,666 B

### UI media

- `hero-workshop-stage.jpg`: 760,808 B
- `noise-soft.svg`: 568 B

### WordPress migrated media

2025/09:

- `img_4844.jpg`: 570,539 B
- `img_7.jpg`: 449,894 B
- `img_8.png`: 339,366 B
- `img_9.png`: 317,268 B

2025/10:

- ConoHa control-panel screenshot: 7,779 B

WordPress subtree total: 1,684,846 B。

known `public/images` + `wp-content/uploads` totalは4,559,586 B、うちraster/photo binaryは約4,539,337 B。

現在は小規模でも、media数に比例してGit historyが増える構造が既に始まっている。

### Refined vNext media boundary

inventory結果からR2-first ruleをroleだけでなくmedia classにも適用する。

R2-first:

- camera photo
- screenshot
- raster article/project visual
- photographic/raster site hero
- AI-generated raster
- gallery media

Git-bundled候補:

- small deterministic SVG
- logo / favicon / icon
- tiny design-system texture
- synthetic test fixture

したがって`hero-workshop-stage.jpg`のようなsite chrome用途でも大きいraster photoはR2へ移す。

## 8. Existing R2 usage

site configは`assets.xpotato.net`をR2 public asset originとして持ち、`r2:/...`をURLへ変換する。

contentで確認できるR2 direct referenceは`vibration-robot`のhero `r2:/blog/my-first-post/GDCH3152.JPG`。

vNextではこのpath literalを維持せず:

```text
legacy R2 object
 -> normalize / rights/provenance review
 -> content-addressed R2 object
 -> Media Registry asset ID
 -> MDX logical media reference
```

へ移す。

## 9. Cloudflare / deployment inventory

current repoにはWorkers Static Assets compatible `wrangler.jsonc`があり:

- application name: `xpotato-site`
- static asset directory: `./dist`
- `not_found_handling: 404-page`

を定義している。

GitHub Actions workflow directoryはcurrent mainに存在しない。legacy READMEはPagesとWorkers Buildsの両説明を含むためcurrent deployment SoTとしては使用しない。

`Xpotato-Server` current inventoryでは:

- `xpotato.net` authoritative zone Active
- website-public-binary-assets用途のR2 bucketが存在

している。

一方desired Cloudflare backup inventoryにはwebsite public mediaのprotection classがまだない。

vNextのR2-first cutover前に、infra側へwebsite media recovery/protection desired stateを追加する必要がある。

site repoへaccount/zone/provider IDは複製しない。

## 10. Current framework / toolchain debt

current package baseline:

- Astro 5.18.1
- React 18
- Tailwind CSS 3.4
- deprecated `@astrojs/tailwind`
- old Content Collections `type: "content"`
- no workspace split
- no repository CI workflow

current `wrangler.jsonc`自体はWorkers Static Assets targetと整合しており、deployment conceptは全面破棄する必要がない。

vNextではcurrent content/toolchainから値を継承せず、accepted architectureへgreenfield rebuildする。

## 11. Legacy HTML debt

`vibration-robot`、ConoHa SSH記事等に`LegacyHtml`が残る。

`vibration-robot`はさらに:

- legacy inline `<img>` paths
- R2 hero
- imported HTML body

を同時に持つrepresentative migration fixtureとして価値が高い。

vNext migration test fixtureとして使用し:

- HTML -> semantic MDX
- old image path -> media asset ID
- R2 legacy hero -> content-addressed object
- category diary -> robotics
- legacy `/?p=693` -> provider redirect

を一括検証する。

ConoHa SSH記事は:

- LegacyHtml
- one screenshot
- code/command examples
- legacy `/?p=811`

を持つため、citation / technical-example / screenshot migration fixtureに適する。

## 12. Migration fixtures selected from current data

最低限次をgolden migration fixtureにする。

1. `gale-storage-backend-compare`
   - clean MDX
   - software/devlog taxonomy migration
   - benchmark claims / technical example verification
2. `codex-sqlite-write-amplification-mitigation`
   - long investigation article
   - external GitHub source citations
   - observed metrics
3. `vibration-robot`
   - LegacyHtml
   - legacy local images + R2 hero
   - robotics category
4. `2025-10-06`
   - LegacyHtml
   - screenshot
   - CLI examples
   - network -> infrastructure category
5. `prime-factorizer`
   - Tool content
   - React island migration
6. `xpotato-site` project
   - project frontmatter cleanup
   - large raster overview -> R2
   - small SVG cover decision

## 13. Decisions closed by this inventory

The inventory resolves these design questions:

- initial Blog top-level categories: `software`, `infrastructure`, `robotics`
- `devlog` is an article mode/history marker, not topical category
- `network` is initially a tag/topic under infrastructure, not top-level category
- Tool initial active category: `calculation`
- Note initial subject seed: `infrastructure`
- media boundary: raster/photo/screenshot -> R2-first even for site chrome; small deterministic SVG/icon may remain Git
- compatibility meta-refresh pages -> real redirects
- PrimeFactorizer is the sole initial interactive-module migration fixture
- website media recovery desired state is an infra handoff requirement

Still requires generated migration output / implementation measurement:

- exact full tag registry and aliases
- ContentId allocation for every entry
- exact media asset ID mapping
- exact query-based WordPress redirect list
- performance / bundle baseline
- R2 object inventory/protection implementation
