---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# vNext Open Decisions

未決事項を「あとで考える」で放置せず、確定に必要なevidenceとphaseを記録する。

current specificationのSoTではない。解決済み事項はcanonical docs/profiles/ADRへ移す。

## O1. Performance budgets

未決:

- route-class JS/CSS byte hard budget
- MiniSearch serialized index / search-route JS transfer budget
- representative image LCP transfer target
- lab thresholds beyond Core Web Vitals

確定方法:

- vNext foundation build
- Blog content-only / Project / Tool / Search route-class measurements
- mobile throttling + representative media profiles
- legacy baseline comparison

phase: site foundation実装後、visual redesign freeze前。

**build実測なしに任意KiB値をarchitectureへ捏造しない。**

## O2. Visual style profile

未決:

- palette / texture
- generated hero illustration style
- hero composition/safe area
- social card visual design
- home/card visual hierarchy

architectureはversioned style profile + deterministic text renderingまで固定済み。

visual redesign phaseで複数candidateを比較する。

## O3. Comparison module child API

`Comparison` moduleのexact child/props APIだけ未固定。

before/after image、code diff、table comparison等を1つのgeneric layout builderへ早期統合しない。

representative migrated/new article fixtureで実需要を確認後にv1 APIを固定する。

## O4. Exact legacy archive ref naming

mechanismは確定:

- annotated Git tag required
- optional legacy branch only if hotfix need exists

exact tag nameはcutover時のactual legacy generation/revisionへ合わせて確定する。

candidate `legacy-site-v1-final` は例示であり現在のmachine SoTではない。

## O5. Cloudflare implementation pin / cutover details

control-plane architectureは解決済み。

未決はimplementation-specific:

- GitHub Actions exact trigger/environment approval policy
- Wrangler exact pinned version/command
- Cloudflare provider/API adapter exact version
- site deploy / infra read-plan / normal mutation permission sets
- source/public/protected media data-plane credential exact mechanism
- temporary credential delegationを採用するか
- existing Workers Builds/Pages/dashboard stateがある場合のretire/import/cutover手順
- provider resource read-back selectors

Dashboard click sequenceは未決事項ではない。

implementation時点のofficial provider API/permission schemaで確定する。

## O6. Public/protected/source media garbage collection

launch default:

- public content-addressed objectをnormal Article Jobがdeleteしない
- private canonical source-mediaにautomatic expirationなし
- private protected-mediaはindefinite lock + automatic expirationなし
- published/approved object cleanupはlaunch scope外

未決:

- never-exported public/source orphan grace period
- retired public/source object GC condition
- Git retained tag/revisionをGC protectionへ含めるalgorithm
- protected storage growthがmaterialになった場合のlock/retention migration

実storage growthが問題になってからseparate privileged GC ADRを設計する。

current designではrecoverability/durabilityをearly storage reclamationより優先する。

## O7. Interactive module bundle budget classes

`small | medium | large` exact byte threshold未決。

PrimeFactorizerをvNextへ移植し、actual React island bundleを測定してから固定する。

class mechanism自体は維持するが、実測前に閾値を決めない。

## O8. Full private Article Job artifact retention

Gitにはcompact Publication Provenanceだけを残すことは確定済み。

一方、full private job workspaceの長期retentionは別問題。

未決:

- source snapshot / semantic request-response / audit artifactのlong-term private archive要否
- successful job workspaceのdefault local cleanup timing
- AI raw provider image bytesのretention期間
- private logsに含まれ得るuser/private data retention

決定境界:

- published media future re-encodeにはprivate canonical media sourceがあるためfull job workspaceは不要
- exact published media recoveryにはprotected-media bucketがあるためfull job workspaceは不要
- deep post-publication audit/research reproducibilityにはprivate artifact archiveが有用

VEP-like lineageのどこまでを長期保持するかはprivacy/storage burdenと比較して別contractで確定する。

Design Freeze前に「full private job archiveをlaunch hard requirementにするか否か」だけは決める。

---

# Resolved during design

## Media processing profiles

`operations/media-processing-profiles.md`でv1確定。

- private canonical raster: lossless WebP / sRGB8 / max long edge 8192
- photo inline: 480/768/1200/1800 + public max2560
- hero: 640/960/1440/1920/2560
- gallery: 320/640/960/1280
- screenshot: lossless WebP + PNG, 480..2560
- social card: 1200x630 PNG
- no upscale

actual implementation promotion時にrepresentative fixture visual reviewを行い、変更が必要ならv2 profileを作る。

## Private canonical media source

raw HEIC/JPEG/PNG originalはsite long-term SoTにしない。

approved privacy-normalized canonical masterだけをseparate private source-media R2へ保存する。

- no public domain
- content-addressed
- no automatic expiration
- normal credential no Delete/config admin
- Bucket Lock initial hard requirementなし

current public exact-byte recoveryはseparate protected-media planeが担う。

## Initial Article Job AI execution profile/resource budget

`operations/ai-execution-profiles.md`で解決。

- source/evidence/revision/visual planning/audit: bounded Terra/Sol profile
- author/content audit: Sol
- image: GPT-Image-2 snapshot profile
- max semantic invocations 15
- search tool calls 10
- image attempts 2
- revision cycles 2
- one transient retry
- text 240s / image 360s timeout

## Technical example verifier

`operations/technical-example-profiles.md`で解決。

sandbox baseline:

- network none
- non-root/read-only rootfs
- no host secrets/devices/sockets
- 256 MiB memory
- PID 32
- 1 CPU
- 15s wall
- 64 MiB workspace
- 1 MiB combined output

initial sandbox execution:

- Python stdlib
- self-contained Node JS
- disposable SQLite

initial parse/type-only:

- Bash
- PowerShell
- TypeScript
- JSON/YAML/Compose config

system/cloud/package manager/Docker workload/Git remote mutationはautomatic execution外。

## Discovery/search profile

`contracts/content-discovery-contract.md` / `operations/static-search-profile.md`で解決。

- Blog/Notes 12/page
- RSS 20 summary
- related max4
- related weights: same collection 1 / primary taxonomy 2 / technology tag 4 / topic tag 2 / minimum 4
- MiniSearch 7.2.0
- tokenizer `xpotato-ja-tech-bigram-v1`
- fuzzy initial off
- search runtime `/search/` only

Pagefind ADR-0016はJapanese tokenizer mismatchを理由にADR-0021でsuperseded。

## Initial taxonomy seeds

Blog 44件:

- `software`: 31
- `infrastructure`: 12
- `robotics`: 1

Notes subject=`infrastructure`、Tool category=`calculation`。

## Media placement boundary

- photo/screenshot/raster project/content/site hero/AI raster/gallery -> R2-first
- small deterministic SVG/logo/favicon/icon/tiny texture/fixture -> Git candidate

## Cloudflare control plane

- GitHub Actions + Wrangler site deploy
- Xpotato-Server Git desired state + OpenTofu/API reconcile
- R2 config admin = operator ephemeral
- Dashboard = bootstrap/billing/recovery/break-glass
- initial custom Cache/Compression/CORS/Cloudflare Images不要

## Published media recovery plane

separate private protected-media R2 + indefinite Bucket Lock + no automatic expiration。

## ContentId

lowercase canonical RFC 4122 UUID v4。

## Compatibility redirects

- `/blog/prime-factorizer/`
- `/blog/category/tools/`

をreal application 301へ昇格。
