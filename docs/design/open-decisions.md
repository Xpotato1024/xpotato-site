---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

未決事項を「あとで考える」で放置せず、確定に必要なevidenceとphaseを記録する。

current specificationのSoTではない。決定後はcanonical doc / machine-readable configへ反映し、materialならADRを作る。

## O1. Media processing numerical profiles

未決:

- private normalized canonical master format / max dimensions
- public fallback/master derivative quality
- inline/hero/gallery width sets
- AVIF/WebP encode quality
- screenshot lossless/lossy policy

architectureは:

- semantic visual audit後にvariant generation
- no upscale
- deterministic prebuilt variants
- Cloudflare Images optional

まで確定。

representative HEIC/photo/screenshot fixturesでquality/sizeを比較し、`media-processing-profiles.md`またはmachine profileへ確定する。

phase: media processing implementation前。

## O2. Performance budgets

未決:

- route-class JS/CSS byte budget
- image transfer target
- lab thresholds beyond Core Web Vitals

legacy/vNext baselineとrepresentative mobile profileで確定。

phase: site foundation + visual redesign前後。

## O3. Visual style profile

未決:

- palette / texture / illustration style
- hero composition
- social card design

visual redesignで複数candidate比較。

architectureはversioned style profileだけ固定済み。

## O4. Comparison module API

representative article fixtureで実需要を確認してchild API固定。

premature generic layout builderを避ける。

## O5. Exact legacy tag / branch naming

annotated tag必須、legacy branch optional。

exact remote-safe nameはcutover taskで決定。

## O6. Cloudflare production exact values / cutover

**control-plane architectureは解決済み。**

確定:

- production site CI/CD = GitHub Actions
- Worker/static asset deploy = Wrangler
- Workers Builds / Pages dashboard build settingをproduction SoTにしない
- Worker custom-domain/DNS/provider Rules = `Xpotato-Server` desired state
- OpenTofuをprovider-supported durable resourceの第一選択
- provider gapはofficial Cloudflare API reconcile adapter
- security-sensitive R2 config desired valuesはGit管理するがconfiguration admin credentialをCP/site CIへ常設しない
- R2 config変更 = operator-authorized ephemeral admin + CLI/API read-back validation
- initial media Cache/Compression/CORS/Cloudflare Images custom stateは不要
- normal operationでCloudflare Dashboard configurationを要求しない

未決なのはimplementation exact valueのみ:

- GitHub Actions trigger / environment approval policy
- Wrangler exact pinned version / command
- Cloudflare provider exact pinned version
- site deploy / infra read-plan / durable mutation token permission sets
- public-media publisher / protected-media writer exact R2 credential mechanism
- existing Workers Builds/Pages stateのretire/cutover procedure

## O7. Private raw media retention

未決:

- article-specific iPhone/original sourceをsite workflowでlong-term retainするか
- retainする場合のprivate storage class
- raw AI generated output retention

public/protected Web mediaとは別trust boundary。

siteが個人写真library全体のSoTになることは避ける。

## O8. Public media garbage collection

default: published versioned public R2 objectをnormal Article Jobが自動削除しない。

initial protected-media copyはindefinite lock + no automatic expirationなので、protected storage reclamationもlaunch scope外。

未決:

- never-exported public orphan grace period
- public retired object retention / GC rule
- protected storage growthがmaterialになった場合のGit retained-ref-aware GC design

## O9. Interactive module bundle budget classes

`small | medium | large`のexact byte threshold未決。

vNext foundation + PrimeFactorizer migration後に測定。

## O10. Published media protection implementation details

**architectureは解決済み。**

initial protection class:

- public delivery bucketと別private protected-media R2 bucket
- no public custom domain
- exact public master/variant bytes
- Bucket Lock indefinite
- automatic expiration none
- public publisher -> no protected access / no delete
- protection writer -> no delete/config/lock modification
- R2 config admin -> operator-held ephemeral only

`Xpotato-Server` proposal branch `codex/site-vnext-cloudflare-control-plane` ADR-0024 + desired inventoryと整合。

未決:

- exact protected object key convention
- public/protected data-plane credential mechanism
- protection operation execution location/invocation
- scheduled integrity verification cadence
- receipt/recovery drill automation detail

## O11. Discovery profile remaining values

initial canonical defaults:

- Blog pagination 12/page
- Notes pagination 12/page
- RSS 20 summary items
- related max 4
- Pagefind Extended

未決:

- related score weights / minimum score
- Pagefind exact pinned version
- initial search UI adapter
- Japanese search regression fixture set

phase: discovery implementation前。

## O12. Technical example execution profiles

contract / isolated workspace boundaryは確定済み。

current migration fixturesにはBash/PowerShell/SQL/technical benchmark articleが存在する。

未決:

- initial supported languages/runtimes
- runtime versions
- resource/time limits
- network-enabled profileが本当に必要か
- shell command risk classifier exact rule set

generic remote code execution platform化せず、selected fixturesからminimum safe profileを設計する。

## Resolved during design

### Initial Article Job AI execution profile

`operations/ai-execution-profiles.md`で解決。

initial adapter:

- OpenAI Responses API
- source_discovery: GPT-5.6 Terra / medium
- evidence: Terra / high
- author: GPT-5.6 Sol / high
- content audit: Sol / high
- revision: Terra / high
- visual plan: Terra / medium
- visual audit: Terra / high
- image generation: GPT-Image-2, snapshot `gpt-image-2-2026-04-21`

Terra -> Sol escalationはmaterial ambiguity/contradiction等のbounded triggerだけ。

### Initial Article Job AI resource budget

same profileで解決。

- total semantic invocations max 15
- search tool calls max 10
- image generation attempts max 2
- semantic revision cycles max 2
- transient retry max 1 per invocation
- text timeout 240s
- image timeout 360s

image provider failure/2 unsuccessful attempts後、Blog heroはdeterministic coverへfallback可能。

### Initial taxonomy seeds

Blog 44件:

- `software`: 31
- `infrastructure`: 12
- `robotics`: 1

`devlog`はArticle Job modeへ。`network`はtag/topic、published 0件`app`はseedしない。
Notes subject=`infrastructure`、Tool category=`calculation`。

### Media placement boundary

current Git known raster/photo約4.54 MB。

- photo/screenshot/raster project/content/site hero/AI raster/gallery -> R2-first
- small deterministic SVG/logo/favicon/icon/tiny texture/fixture -> Git candidate

### Cloudflare dashboard boundary

- GitHub Actions + Wrangler site deploy
- Xpotato-Server Git desired state + OpenTofu/API reconcile
- R2 config admin = ephemeral operator capability
- Dashboard = bootstrap/billing/recovery/break-glass

### Responsive media provider dependency

prebuilt responsive R2 variants baseline、Cloudflare Images optional。

### Published media recovery plane

public delivery R2とは別private protected-media bucket + indefinite Bucket Lock + no automatic expiration。

### Collection-specific schemas outside Blog

Notes / Projects / Tools / Pages contract定義済み。

### ContentId encoding

lowercase canonical RFC 4122 UUID v4。

### Static search engine

Pagefind Extended。exact version/UIはO11。

### Compatibility redirects

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

をreal application 301へ昇格。
