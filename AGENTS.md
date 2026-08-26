# AGENTS.md

## Scope

`Xpotato1024/xpotato-site`で作業するAI agent向けrepository-local instruction。

恒常ルールを個別promptへ複製せず、`docs/README.md`のSoT Mapから必要なcanonical/proposed documentを読む。

## Read first

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/architecture/design-status.md`
4. `docs/product/product-context.md`
5. AI article taskなら`docs/product/ai-authoring-context.md`
6. relevant architecture / contract / operations docs
7. material decisionなら`docs/design/adr/`
8. provider/Cloudflare scopeなら`docs/architecture/infrastructure-handoff.md`
9. audit taskなら`docs/governance/audit.md` + `docs/governance/severity.md`
10. implementation / validation

Product/authoring goal is above framework convenience and legacy implementation。

`status: proposed`はreview targetでありaccepted/current production stateではない。Lifecycleは`design-status.md`だけから判断する。

## Clean-room audit

Phase-gate auditでは:

- exact site revisionをSHA固定
- material cross-repo dependencyは`infrastructure-handoff.md`のexact SHAだけを読む
- past chat/model memory/uncommitted intent/legacy docsで欠落を補完しない
- mutable branch headをauthorityにしない
- audit pass中にfindingを修正しない
- finding/verdict固定後に別remediation pass
- remediation後new exact revisionをfresh re-audit

P0/P1 block、P2 deferrable。Audit PASSだけでADR/docをaccepted/canonicalへpromoteしない。Operator explicit freeze decision required。

## Documentation boundary

- vNext specification: `docs/`
- old `doc/` / root legacy detail: migration evidence only
- ADR: decision rationale/history; current SoTではない
- `docs/audits/`: historical report; architectureを定義しない
- design-time inventory: `docs/migration/current-site-inventory-2026-08-26.md`
- cutover時はexact frozen legacy tagから再inventory

## Content identity / authoring

- every vNext content has stable lowercase canonical UUIDv4 `ContentId`
- ContentId != slug/file/title/route
- same semantic content route rename => same ContentId + redirect
- Media Registry/provenance/update/related lineage bind ContentId
- unknown/missing/duplicate IDをsilent repairしない
- durable authoring model follows ADR-0027: portable Markdown/MDX + managed registries
- taxonomy uses stable registry IDs; unknown term silent fallback/create禁止
- approved semantic content modules only; arbitrary article JSX/runtime imports are not the normal API
- Tool/Demo implementation binds Interactive Module Registry; content owns no React source path/hydration directive
- provider/storage/search/SEO implementation fields are system-derived/registry-owned where defined

## Frontend

- static HTML first
- Node = build/authoring toolchain, not public server runtime
- public site / AI authoring / media processing / example verifier are workspace-separated
- normal UI=Astro
- React=stateful interactive island only
- no site-wide SPA/ClientRouter by default
- Tailwind 4 + CSS tokens
- no unintended hydration on content-only routes

## Content

- MDX/Markdown standard
- SEO/archive/feed/search/media variants are system-derived where defined
- frontmatterにprovider/media/component/hydration pathを入れない
- raw WordPress HTML is migration debt, not new publishing path
- current/version-sensitive claim requires current source
- benchmark/observed output/causeを観測なしに生成しない

## Sources / citations / durable claim lineage

- source discovery proposal != canonical source pin
- AI author may cite only fixed Source ID logical markers
- executor compiles validated public citation metadata
- private locator/source bodyをpublic citationへ漏らさない
- detailed Source/Evidence/Claim artifacts may be job-private
- **every published material Article Job claim must have cleanup-safe `CompactMaterialClaimBinding` in Git provenance**
- durable claim binding must resolve to durable `CompactSourceRef` identities
- hashだけ残してclaim->evidence/source mappingを失わない

## External AI disclosure

Exact contract=`docs/contracts/external-ai-disclosure-contract.md` / ADR-0026。

- `externalTextAI=true` / `externalImageAI=true` means provider-use upper bound only
- provider-use permission does **not** admit any particular source/artifact bytes
- `publicSafe`, citation eligibility, source trust, public URL availability are not disclosure authority
- private/unknown disclosure defaults deny
- credential/password/private key/session cookie/Authorization header/MFA/recovery code/capability-bearing signed URL等のactual secret bytes are hard-deny
- explicit user/repository/system authorization is normalized to hash-bound disclosure records by deterministic executor
- `allow_derived_only` sends only an admitted local redacted/derived artifact; raw source must not leave the trusted boundary
- every external search/text/vision/image request must bind an `ExternalAiDisclosureManifest`
- manifest entry set must exactly equal the actual outbound provider input artifact set
- changed artifact hash makes prior admission stale
- semantic AI/Skill/provider cannot self-authorize, broaden, or fabricate disclosure permission
- required denied evidence must use safe derivative/local backend, request authorization, narrow/remove claim, or BLOCK; do not silently omit it and claim completeness
- full private disclosure manifests may be cleaned with the job; durable Git keeps only safe policy/manifest/run hash lineage as defined by provenance contract

## Technical examples

- AI-generated code/commandをhostで直接automatic executionしない
- execution boundary=`packages/example-verifier`
- profiles=`docs/operations/technical-example-profiles.md`
- network default deny / no credentials / bounded resources
- initial sandbox execution: self-contained Python / Node / SQLite only
- Bash/PowerShell/TypeScript/config initially parse/typecheck-centric
- system/admin/cloud/package-manager/Docker/Git remote mutation automatic execution禁止
- syntax pass != “動作確認済み”
- observed output requires execution/evidence lineage

## Article Job

- AI never writes canonical `apps/site/src/content/` directly
- semantic AI=fixed request + Skill snapshot + response schema
- deterministic executor owns import/state/artifacts/disclosure admission
- source/evidence/claim separated
- author/auditor and visual planner/auditor fresh context
- example assessment before content audit
- P0/P1 content finding blocks visual/approval
- human approval cannot be delegated to AI/Skill
- approval before persistent media mutation

Normal persistence/export:

```text
HUMAN_APPROVED
 -> MEDIA_SOURCE_STORED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

Before `EXPORTED`, deterministic exporter must materialize:

- durable material claim support ledger
- compact canonical media source identity
- compact AI/tool/disclosure lineage
- full publication/protection hashes
- **cleanup-safe CompactMediaRecoveryBinding** from valid full protection receipt

Post-approval operational receipt fields may be appended only if same exact candidate/approval/content/media/support is preserved。If content/media/support changes, approval stale。

Full job workspace is private/ephemeral. Cleanup only after durable Git ref + durable claim/recovery lineage + source/public/protection chain validates and operator confirms。

## Visual / media

- Blog hero required; other collection visual policy remains distinct
- AI hero = conceptual/decorative, not technical evidence
- factual diagram/chart uses deterministic/evidence source where possible
- photo/screenshot/raster project/site hero/AI raster/gallery not committed to Git
- HEIC/HEIF input allowed
- raw camera original is not site long-term SoT
- ingest -> privacy-normalized lossless canonical master
- visual audit **before** delivery variants
- approved canonical master -> private canonical source storage
- public delivery master/variants -> content-addressed immutable object storage
- exact public bytes -> separate protected recovery plane
- baseline variants prebuilt; Cloudflare Images optional only
- same key/different bytes overwrite prohibited
- rights-unknown Web media not republished
- MDX uses `media:<asset-id>`, no direct site-owned R2/object URL
- normal site build does not download remote media bytes
- raw/private image bytes sent to external vision/image providers still require ADR-0026 disclosure admission
- recovery after job cleanup starts from Git `mediaRecovery` binding, not old chat/full job workspace

Small deterministic SVG/logo/favicon/icon/tiny texture/fixture only are Git-bundled candidates。

## Discovery/search

- archives/pagination/RSS/related generated deterministically
- initial: Blog/Notes 12/page, RSS 20 summary, related max4
- static search target=MiniSearch 7.2.0 + shared tokenizer `xpotato-ja-tech-bigram-v1`
- same tokenizer source for build and browser query
- Japanese/CJK primary overlapping bigram; fuzzy off initially
- serialized index build artifact, not Git source
- search runtime only `/search/`; article routes get no search JS
- `/search/` noindex
- draft/noindex excluded from initial site search

ADR-0016 Pagefind proposal is Rejected. Do not reintroduce Pagefind unless new material ADR/evidence changes decision。

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

Skill does not grant approval/disclosure/deploy/upload/protection/credential/merge permission。

## Migration

While Design=`PRE_FREEZE_REVIEW`, production implementation/migration is blocked。

After accepted freeze:

- freeze legacy main with annotated Git tag
- no full `archive/old-src` in active vNext
- greenfield npm workspaces
- regenerate exact frozen inventory
- migrate content/routes/taxonomy/interactive/media with stable ContentId
- initial Blog category seed=`software / infrastructure / robotics`
- raster media gets canonical source/public/protected coverage before old active Git copies removed
- parity then remove old active implementation

## Git/change

- no direct main push
- feature branch + PR
- material decision -> SoT + ADR
- do not mix framework migration/visual redesign/unrelated cleanup into one giant PR
- do not overwrite unrelated user changes

## Cloudflare / infrastructure

Current vNext provider counterpart is **Proposed and provider mutation BLOCKED**. Read exact revision/status only via `docs/architecture/infrastructure-handoff.md`。

Do not treat proposed bucket/resource names as current desired state。

Target responsibilities after acceptance:

- site CI/CD=GitHub Actions, deploy=Wrangler
- no Cloudflare Workers Builds/Pages dashboard SoT
- DNS/Worker domain/provider R2/rules=`Xpotato-Server`
- normal config via Git + OpenTofu/API/CLI
- Dashboard only bootstrap/billing/account recovery/break-glass/true provider-gap
- R2 configuration admin operator-ephemeral; not persistent CP/site CI credential
- provider IDs/secrets never copied into content/media contracts

No Cloudflare/R2/DNS/Worker provider mutation before design gate acceptance and explicit authorization。

## Validation

- repository-defined deterministic entrypoints
- schema/ContentId/taxonomy/citation/example/media/search/route/provenance validation
- every external AI request exact-set disclosure manifest valid; hard-deny secret fixtures enforced
- every Article Job material claim durable binding valid
- mediaRecovery binding exact-equals publication/protection object set
- cleanup rejects missing durable claim/recovery lineage
- AI self-report is never validation authority
- normal build has no remote media/provider dependency
- external provider/media checks separate integration gate
- cross-repo handoff exact SHA/status validated

## Human-facing language

Human-facing docs/Issue/PR/article are Japanese by default. Identifier/path/CLI/product/source title may remain original language。

## Safety

- no secret/token/private info in Git/publication or unauthorized external-AI request
- no GPS/private EXIF in canonical/public media
- no generated visual misrepresented as factual screenshot/benchmark
- no rights-unknown media redistribution
- destructive/external/production mutation requires explicit scope/authorization and an open lifecycle gate
