---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# External Sources

vNext designのexternal provenance / cross-repository precedentを集約するsupporting reference。Policy SoTではない。

## Cross-repository precedent

### video-evidence-pipeline

Article Job pattern reference:

- pipeline: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/pipeline-architecture.md
- artifact model: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/artifact-model.md
- state machine: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/state-machine.md
- AI exchange: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/operations/ai-exchange.md
- agent model: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/agent-operating-model.md

Adopted patterns: fixed schema exchange, deterministic import/write, artifact lineage, independent audit, bounded revision, exact-hash human approval。

### Xpotato-Server

Historical/current-main precedent only; actual vNext counterpart is exact-SHA pinned by `architecture/infrastructure-handoff.md`。

- SoT map: https://github.com/Xpotato1024/Xpotato-Server/blob/main/docs/README.md
- backup/recovery: https://github.com/Xpotato1024/Xpotato-Server/blob/main/docs/architecture/backup-recovery.md
- R2 destruction resistance ADR-0020: https://github.com/Xpotato1024/Xpotato-Server/blob/main/docs/decisions/ADR-0020-r2-backup-destruction-resistance.md

Site defines provider-neutral media/source/recovery requirements; actual provider resources/credentials/locks are infra-owned after the relevant infra design is accepted。

## Astro / frontend

- Islands: https://docs.astro.build/en/concepts/islands/
- Client directives: https://docs.astro.build/en/reference/directives-reference/
- Cloudflare Workers + Astro: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Astro images: https://docs.astro.build/en/guides/images/
- Astro styling: https://docs.astro.build/en/guides/styling/
- deprecated `@astrojs/tailwind`: https://docs.astro.build/en/guides/integrations-guide/tailwind/

## Media / image formats

- Apple HEIF/HEVC: https://support.apple.com/ja-jp/116944
- WebP lossless/lossy: https://developers.google.com/speed/webp
- libwebp utilities: https://developers.google.com/speed/webp/docs/cwebp
- Sharp installation: https://sharp.pixelplumbing.com/install/
- Sharp metadata/output: https://sharp.pixelplumbing.com/api-output/
- Cloudflare R2 API: https://developers.cloudflare.com/r2/api/
- R2 custom-domain caching: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- R2 Bucket Locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Cloudflare Images transformations (optional only): https://developers.cloudflare.com/images/optimization/transformations/overview/

HEIC decode/encoder exact toolchain is pinned/validated during implementation. Cloudflare Images is not baseline dependency。

## OpenAI AI/image adapter reference

Provider facts are time-sensitive and not architecture SoT. Reverify at implementation/profile-update time。

- models: https://developers.openai.com/api/docs/models
- GPT Image: https://developers.openai.com/api/docs/models/gpt-image-2
- C2PA/SynthID: https://help.openai.com/en/articles/8912793-c2pa-and-synthid-in-openai-generated-images
- provenance overview: https://openai.com/index/advancing-content-provenance/

Exact model/snapshot/effort belongs to versioned execution profile。

## Cloudflare control plane / delivery

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- external CI/GitHub Actions: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Worker custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- R2 API/tokens: https://developers.cloudflare.com/r2/api/
- R2 temporary credentials: https://developers.cloudflare.com/r2/api/s3/temporary-credentials/
- Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Compression Rules API: https://developers.cloudflare.com/rules/compression-rules/create-api/

Exact provider capability/version/permission names are reverified before acceptance/implementation and do not substitute for the pinned infra handoff。

## Static search

### Current vNext proposal

- MiniSearch npm: https://www.npmjs.com/package/minisearch
- MiniSearch docs: https://lucaong.github.io/minisearch/

MiniSearch permits a repository-owned tokenizer shared by index build and browser query, plus serialized static index。

### Historical Pagefind evaluation

- Pagefind multilingual docs: https://pagefind.app/docs/multilingual/
- Japanese index/query tokenizer mismatch issue: https://github.com/Pagefind/pagefind/issues/1237

ADR-0016 Pagefind proposal was **Rejected**。ADR-0021 is the current MiniSearch replacement **proposal** and remains Proposed until explicit Design Freeze adoption。Pagefind sources remain only as decision evidence。

## Runtime/tool versions for technical-example profiles

Reverify when implementing/profile updating:

- Python downloads: https://www.python.org/downloads/
- Node releases: https://nodejs.org/en/about/previous-releases
- PowerShell lifecycle: https://learn.microsoft.com/powershell/scripting/install/powershell-support-lifecycle
- SQLite changes: https://sqlite.org/changes.html

## Browser compatibility

- MDN Baseline: https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility
- web.dev Baseline: https://web.dev/baseline

## Node

- Astro prerequisites: https://docs.astro.build/en/install-and-setup/
- Node releases: https://nodejs.org/en/about/previous-releases
- Node crypto randomUUID: https://nodejs.org/api/crypto.html

## Web performance

- Web Vitals: https://web.dev/articles/vitals
- Optimize INP: https://web.dev/articles/optimize-inp

## Accessibility

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI WCAG overview: https://www.w3.org/WAI/standards-guidelines/wcag/

## SEO

- Google canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Search documentation updates: https://developers.google.com/search/updates

## Security/privacy

- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JS: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html

## Agent Skills

- spec: https://agentskills.io/specification
- GitHub spec: https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- best practices: https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx

## Writing/readability

- Tateisi, Ono, Yamada, COLING 1988: https://aclanthology.org/C88-2135/
- Sato, Matsuyoshi, Kondoh, LREC 2008: https://aclanthology.org/L08-1230/
- Margulieux et al. 2020: https://link.springer.com/article/10.1186/s40594-020-00222-7
- van Gog et al. 2011: https://doi.org/10.1016/j.cedpsych.2010.10.004

Research evidence is not used to justify rigid prose templates/universal sentence limits; it informs reader targeting/segmentation/worked examples/verification review。
