---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

current specificationのSoTではない。未決は実測/provider implementationでしか合理的に決められない項目へ限定する。

## O1. Performance budgets

未決:

- route-class JS/CSS byte hard budget
- MiniSearch serialized index / search-route JS transfer budget
- representative image LCP transfer target
- lab thresholds beyond Core Web Vitals

vNext foundation build + mobile/profile measurementで確定する。

**build実測なしに任意KiB値をarchitectureへ捏造しない。**

## O2. Visual style profile

未決:

- palette / texture
- generated hero illustration style
- hero composition/safe area
- social card visual design
- home/card visual hierarchy

visual redesign phaseで複数candidate比較。

## O3. Comparison module child API

before/after image、code diff、table comparison等のrepresentative fixtureを見てv1 APIを固定する。

premature generic layout builderを避ける。

## O4. Exact legacy archive ref naming

mechanismは確定:

- annotated Git tag required
- optional legacy branch only if hotfix need exists

exact nameはcutover actual revisionへ合わせる。

## O5. Cloudflare implementation pin / cutover details

architectureは解決済み。

未決:

- GitHub Actions exact trigger/environment approval
- Wrangler/provider/API adapter exact versions
- site deploy / infra read-plan / normal mutation permission sets
- source/public/protected media data-plane credential exact mechanism
- temporary credential delegation採否
- existing Workers Builds/Pages/dashboard stateのretire/import/cutover
- provider resource read-back selectors

implementation時点のofficial provider schemaで確定する。

## O6. Public/protected/source media garbage collection

launch default:

- normal Article Jobはdeleteしない
- source-media automatic expirationなし
- protected-media indefinite lock + no expiration
- approved/published object cleanupはlaunch scope外

未決:

- never-exported public/source orphan grace period
- retired public/source object GC condition
- Git retained refsをGC protectionへ含めるalgorithm
- protected storage growthがmaterialになった場合のlock/retention migration

実storage growthが問題になった時点でseparate privileged GC ADRを設計する。

## O7. Interactive module bundle budget classes

`small | medium | large` exact threshold未決。

PrimeFactorizer vNext actual bundle測定後に固定する。

---

# Resolved during design

## Media processing profiles

`operations/media-processing-profiles.md`。

- canonical raster: lossless WebP / sRGB8 / max 8192
- photo inline widths: 480/768/1200/1800
- hero: 640/960/1440/1920/2560
- gallery: 320/640/960/1280
- screenshot: lossless WebP + PNG
- social card: 1200x630 PNG
- no upscale

## Private canonical media source

`contracts/private-canonical-media-storage-contract.md`。

- raw camera originalはsite long-term SoTにしない
- approved privacy-normalized canonical masterだけprivate source-media R2へ保存
- no public domain
- content-addressed
- no automatic expiration
- normal credential no Delete/config admin
- initial Bucket Lockなし

## Full Article Job retention

`operations/article-job-retention-policy.md`。

launchではfull job workspace用long-term R2 archiveを作らない。

- full workspace = ephemeral operational state
- automatic time-only TTL deleteなし
- durable Git ref + canonical source/public/protected receiptsをverifyした後だけexplicit cleanup
- cleanupはjob workspaceだけを削除しGit/R2をdeleteしない
- raw AI image/source snapshot/private logsを永久保存しない
- deep forensic archiveが将来requirement化した場合だけ別private archive ADR

## Initial Article Job AI profile/resource budget

`operations/ai-execution-profiles.md`。

- bounded Terra/Sol stage mapping
- GPT-Image-2 image profile
- semantic invocations max15
- search tool calls max10
- image attempts max2
- revision cycles max2
- one transient retry
- text 240s / image 360s

## Technical example verifier

`operations/technical-example-profiles.md`。

sandbox:

- network none
- non-root/read-only rootfs
- 256 MiB
- PID32
- CPU1
- wall15s
- workspace64 MiB
- output1 MiB

execute: Python stdlib / self-contained Node / disposable SQLite。

parse/type-only: Bash / PowerShell / TypeScript / JSON/YAML/Compose。

system/cloud/package manager/Docker workload/Git remote mutationはautomatic execution外。

## Discovery/search profile

- Blog/Notes 12/page
- RSS 20 summary
- related max4
- weights 1/2/4/2, minimum4
- MiniSearch 7.2.0
- tokenizer `xpotato-ja-tech-bigram-v1`
- fuzzy initial off
- `/search/` only

Pagefind ADR-0016はADR-0021でsuperseded。

## Initial taxonomy seeds

- Blog: software31 / infrastructure12 / robotics1
- Notes subject: infrastructure
- Tool category: calculation

## Media placement

photo/screenshot/raster project/content/site hero/AI raster/gallery -> R2-first。

small deterministic SVG/logo/favicon/icon/tiny texture/fixture -> Git candidate。

## Cloudflare control plane

- GitHub Actions + Wrangler
- Xpotato-Server desired state + OpenTofu/API
- R2 config admin ephemeral operator only
- Dashboard bootstrap/billing/recovery/break-glass
- initial custom Cache/Compression/CORS/Cloudflare Imagesなし

## Published media recovery

separate private protected-media R2 + indefinite Bucket Lock + no automatic expiration。

## ContentId

lowercase canonical RFC 4122 UUID v4。

## Compatibility redirects

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

をreal application 301へ昇格。
