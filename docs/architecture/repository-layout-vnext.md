---
status: proposed
owner: architecture
last_verified: 2026-11-03
canonical_for:
  - vNext repository layout
  - source ownership boundaries
---

# vNext Repository Layout

現在の通常編集の入口・ファイル所有は[4経路の手順](../operations/content-workflows.md)を参照する。`templates/content/`は記事/private Jobと固定ページの開始本文、`templates/browser-tool-sync/`は独立tool sourceの雛形。公開manifest/CSPは`tools/build/publication.ts`、配信計画の共通compilerは`scripts/release/deployment/publication-plan.mjs`。作成/書込みはtools/authoring、build補助はtools/build、定常QAはtools/qa、保存CI入口はtools/publicationへ整理する。[所有と保留資産](../../tools/README.md)を参照。workspace境界は変えない。

## Decision

vNext uses npm workspaces to separate public site, AI authoring, media processing, and technical-example execution。

Photographic/raster media is object-storage first。Git remains source/text/contracts/registries/small deterministic assets centered。

Production CI/CD is GitHub Actions; Cloudflare Dashboard build configuration is not a second SoT。

現在の実配置、旧構成撤去と原画像移管、全vendor版の具体的参照と復元条件は[配置と所有](../operations/repository-ownership.md)を参照する。全root subtreeの変更・維持理由と検証範囲は[整理範囲](../operations/repository-restructuring-coverage.md)を参照する。以下はPR141の配置であり、未採用のDraft差分を含む。

## 配置

```text
.
├─ .agents/skills/                 # repository-localの作成・監査・SEO・更新手順
├─ .github/workflows/              # 実CI・手動保存・手動配信の唯一のworkflow
├─ apps/site/
│  ├─ astro.config.mjs / wrangler.jsonc / package.json
│  ├─ src/
│  │  ├─ content/                  # 正式export済み本文
│  │  ├─ content-registry/         # taxonomy/media/interactive/provenance/editorial
│  │  ├─ components/ layouts/ pages/ styles/ search/
│  │  └─ lib/                      # articles/content/discovery/home/media/tools
│  ├─ public/                      # 公開font・favicon・小さい配信asset
│  ├─ source-inputs/               # 既存9原画像・reviewed home recipe（非配信）
│  └─ licenses/prime-factorizer/    # Site compositionのsource offer
├─ config/                        # trusted admission・font・performance・monitor baseline
├─ packages/
│  ├─ content-contracts/src/        # 共有contract + article/migration/profiles
│  ├─ article-pipeline/src/         # core + candidate/review/publication/media/visual
│  │  └─ test-support/retired-operator/ # 旧方式の非live回帰モデル
│  ├─ site-validators/src/          # common + migration/browser-tools/delivery
│  ├─ media-ingest/                 # 決定的media処理
│  ├─ example-verifier/             # 分離した検証sandbox
│  └─ portable-content/             # portable本文の構文と安全検査
├─ tools/                         # authoring/build/qa/publication/migration/review/assets
├─ scripts/                       # CI分類のみ
│  └─ release/                    # artifact/deployment/monitoring/shared
├─ templates/                     # content/browser-tool-sync/monitoring
├─ tests/fixtures/                 # synthetic入力・凍結移行証跡
├─ schemas/                       # generated/<8領域> + release（manual schema）
├─ vendor/browser-tools/           # 現選択版のみ、旧版は固定Gitで検査/復元
├─ docs/                          # 現行索引/契約/手順と明示した履歴・受入記録
├─ package.json / package-lock.json / tsconfig* / vitest.config.ts
└─ .local/                        # 非追跡private Jobと検証出力
```

旧root src/public/旧アプリ設定は存在しない。root workspace設定は現役であり、アプリ設定の重複ではない。詳細な各folderの実行入口は[tools](../../tools/README.md)と[scripts](../../scripts/README.md)を参照する。

Subdirectory names inside implementation workspaces are candidate organization and may be refined without changing the ownership boundary。The material boundary is the workspace/capability direction, not a particular internal file name except where a profile/contract explicitly declares machine SoT target。

## Documentation/governance boundary

- `architecture/design-status.md`: lifecycle authority
- `architecture/infrastructure-handoff.md`: exact cross-repo provider revision binding
- `governance/audit.md`: clean-room procedure
- `governance/severity.md`: P0/P1/P2
- `audits/`: historical reports only

Agent/code must not infer lifecycle from branch/file existence。

## GitHub Actions ownership

### `ci.yml`

- npm ci
- schema/profile freshness
- contract/unit tests
- ContentId/taxonomy/media/provenance validation
- external-AI disclosure default-deny/hard-deny/exact-set fixtures
- Astro check/build
- MiniSearch serialized index + Japanese/technical regression tests
- no Cloudflare credential

### `deploy-site.yml`

Only after lifecycle/implementation gate opens:

- exact reviewed revision
- deterministic validation/build
- scoped Worker deploy credential
- Wrangler deploy
- production smoke

No Cloudflare Workers Builds second authority。

## Dependency direction

```text
                     content-contracts
             ┌────────────┼──────────────┐
             │            │              │
             v            v              v
           site     article-pipeline  example-verifier
             ^            │
             │            └────> media-ingest
             │
      site-validators
```

Rules:

- site -> article-pipeline/example-verifier/provider SDK prohibited
- content-contracts -> provider SDK/Astro/sandbox runtime prohibited
- example-verifier/media-ingest -> Astro runtime prohibited
- validators build/dev-only

## `apps/site`

Only deployed application workspace after implementation acceptance。

Owns:

- Astro content/pages/layout/components
- taxonomy/media/interactive/provenance registries
- discovery config
- shared MiniSearch tokenizer/build/client adapter
- media rendering adapter
- application-local Wrangler config

Normal build does not download source/public/protected media bytes or private Article Job/disclosure artifacts。

### Wrangler boundary

Owns Worker/static-assets application config only。

DNS, production hostname, R2 resources/custom domain/provider rules are infra-owned and status is read through `architecture/infrastructure-handoff.md`。

## `packages/content-contracts`

Implementation-stage Zod/config machine SoT for:

- ContentId/frontmatter/taxonomy
- portable content/module/interactive contracts
- source/evidence/claim
- ExternalAiDisclosureRecord / ExternalAiDisclosureManifest
- initial disclosure profile machine representation
- media source/registry/rights/variants/publication/protection/recovery
- durable Publication Provenance
- technical examples / Article Job schemas

No provider SDK/Astro implementation。

## `packages/article-pipeline`

Owns deterministic authoring control plane:

- ArticleJobSpec/fingerprint/state/artifact lineage
- source discovery handoff + deterministic pinning
- disclosure policy application / explicit authorization normalization
- local derived-only artifact production orchestration
- exact request disclosure-manifest compilation and final outbound-set validation
- semantic provider request/import adapters
- evidence/author/audit/visual stages
- verifier/media invocation
- human approval plumbing
- source/public/protected persistence handoffs
- durable compact claim/disclosure/recovery provenance export
- explicit cleanup eligibility

It does **not** let a semantic Skill/provider self-authorize input disclosure or append hidden external context after manifest compilation。

It does not execute arbitrary technical commands in its own process。

## `packages/media-ingest`

- HEIC/etc -> privacy-normalized canonical master
- canonical -> deterministic delivery variants
- local redaction/metadata-safe image derivative capability may be reused by an external-disclosure derived-only workflow through a typed boundary
- no direct Git/R2 publication in processing stage

## `packages/example-verifier`

Only bounded profiles from `operations/technical-example-profiles.md`。

Must not mount production credentials, mutate canonical site, deploy externally, or execute arbitrary host commands。Network default deny。

## `packages/site-validators`

Validates:

- content/routes/taxonomy/modules/media/provenance/SEO/discovery/search
- Article Job exported state and cleanup-safe lineage
- disclosure profile/schema freshness
- disclosure default-deny/hard-deny/manifest exact-set fixtures

Provider/R2 availability/drift is a separate external entrypoint。

## `apps/site/public`

Passthrough/control assets only。No article/project/screenshot/photographic site hero storage。

## Git media admission

Allowed candidates:

- small deterministic SVG
- logo/favicon/icon
- tiny design texture
- synthetic fixture

Object-storage first:

- photo
- screenshot
- raster content/project visual
- photographic/raster site hero/background
- AI raster
- gallery media

## Private generated/job artifact guard

Do not commit:

- MiniSearch serialized index
- delivery variants/canonical media bytes
- Astro dist
- private Article Job source/evidence/disclosure/request/response artifacts
- verifier logs

Publication Provenance contains only safe compact lineage, not the private job workspace copy。

## External media planes

Target semantics expect:

1. private canonical source-media
2. public delivery media
3. private exact-byte protected recovery

Actual provider resources are not site SoT。稼働状況は現在のinfrastructure handoffとdeployment statusを参照し、設計時のProposedという表記から実状態を推測しない。

## Legacy

Old full source is preserved by Git tag/optional legacy branch, not active `archive/old-src`。

## Portable contentとprivate authoring実装

packages/portable-contentは既存portable MDX AST検証をsite validatorとarticle-pipelineで共有し、非実行型draft rendererを提供します。packages/article-pipelineはprivate job/CLI/localhost preview、tools/authoring/site.tsとarticle-repository.tsはrepository adapterです。公開apps/siteはauthoring packageへ依存しません。操作と限界は[非公開下書きpreview](../operations/private-markdown-preview.md)。
