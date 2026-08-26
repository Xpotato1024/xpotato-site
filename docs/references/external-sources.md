---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# External Sources

この文書はvNext designのexternal provenance / cross-repository precedentを集約するsupporting referenceであり、repository policy自体のSoTではない。

## Cross-repository design precedent

### video-evidence-pipeline

Article Jobの直接dependencyではないがAI pipeline patternの参照実装。

- pipeline architecture: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/pipeline-architecture.md
- artifact model: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/artifact-model.md
- state machine: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/state-machine.md
- AI exchange: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/operations/ai-exchange.md
- agent operating model: https://github.com/Xpotato1024/video-evidence-pipeline/blob/main/docs/architecture/agent-operating-model.md

adopted pattern:

- fixed request / response schema
- deterministic import / canonical write
- immutable artifact lineage
- author/auditor separation
- bounded revision
- exact-hash human approval

video/FFmpeg domain schemaはsiteへ直接移植しない。

### Xpotato-Server

Infrastructure ownership / recovery precedent:

- documentation SoT map: https://github.com/Xpotato1024/Xpotato-Server/blob/main/docs/README.md
- backup/recovery architecture: https://github.com/Xpotato1024/Xpotato-Server/blob/main/docs/architecture/backup-recovery.md

site repoはR2 media recovery requirementを定義するが、backup bucket / credential / lock / retention implementationはinfrastructure SoTへ委譲する。

## Astro / static architecture

- Islands architecture: https://docs.astro.build/en/concepts/islands/
- Client directives: https://docs.astro.build/en/reference/directives-reference/
- Cloudflare Workers + Astro: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Astro 7.2 release: https://astro.build/blog/astro-720/

## Images / media

- Astro images: https://docs.astro.build/en/guides/images/
- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
- Sharp installation: https://sharp.pixelplumbing.com/install/
- Sharp output metadata: https://sharp.pixelplumbing.com/api-output/
- Cloudflare Images formats: https://developers.cloudflare.com/images/get-started/limits/
- Cloudflare Images transformations: https://developers.cloudflare.com/images/optimization/transformations/overview/
- R2 caching with custom domains: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/

## OpenAI image-generation adapter reference

Provider is not architecture SoT. implementation時にcurrent factsを再検証する。

- GPT-Image-2: https://developers.openai.com/api/docs/models/gpt-image-2
- C2PA / SynthID: https://help.openai.com/en/articles/8912793-c2pa-and-synthid-in-openai-generated-images
- provenance overview: https://openai.com/index/advancing-content-provenance/

exact model/snapshotはversion-controlled provider profile所有。

## Cloudflare static delivery / compression

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- content compression: https://developers.cloudflare.com/speed/optimization/content/compression/

## Static search / Pagefind

- Pagefind docs: https://pagefind.app/docs/
- multilingual / Japanese support: https://pagefind.app/docs/multilingual/
- configuration options: https://pagefind.app/docs/config-options/
- search API: https://pagefind.app/docs/api/

Pagefind specialized Japanese/Chinese segmentation is provided bythe extended release; current npm wrapper uses extended binary. Exact package version is implementation SoT and must be rechecked when adopted.

## Browser compatibility

- MDN Baseline: https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility
- web.dev Baseline: https://web.dev/baseline

## Tailwind

- Astro styling: https://docs.astro.build/en/guides/styling/
- deprecated `@astrojs/tailwind`: https://docs.astro.build/en/guides/integrations-guide/tailwind/

## Node

- Astro install prerequisites: https://docs.astro.build/en/install-and-setup/
- Node release status: https://nodejs.org/en/about/previous-releases
- Node 24 LTS migration/support: https://nodejs.org/en/blog/migrations/v22-to-v24
- Node crypto API (`randomUUID`): https://nodejs.org/api/crypto.html

ContentId uses UUID v4 because Node build/authoring toolchain can generate standard cryptographically-random UUID v4 without an additional ID package.

## Web performance

- Web Vitals: https://web.dev/articles/vitals
- Optimize INP: https://web.dev/articles/optimize-inp
- client-side rendering/interactivity: https://web.dev/articles/client-side-rendering-of-html-and-interactivity

## Accessibility

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG overview: https://www.w3.org/WAI/standards-guidelines/wcag/

## SEO / discovery

- Google canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Search documentation updates: https://developers.google.com/search/updates

## Security / privacy

- Workers Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JavaScript: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html

## Agent Skills

- specification: https://agentskills.io/specification
- GitHub spec: https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- best practices: https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx

## OSS writing Skill references

- inference-sh technical blog writing: https://skillmd.com/plugins/skillmd/publish-technical-blog-post
- Mark-Life writing-for-readers: https://github.com/Mark-Life/agent-skills/blob/main/skills/communication/writing-for-readers/SKILL.md
- mazrean writing-technical-design: https://github.com/mazrean/agent-skills/blob/main/skills/writing-technical-design/SKILL.md

## Japanese readability / technical writing evidence

- Tateisi, Ono, Yamada, COLING 1988: https://aclanthology.org/C88-2135/
- Sato, Matsuyoshi, Kondoh, LREC 2008: https://aclanthology.org/L08-1230/

## Worked examples / programming instruction

- Margulieux et al., 2020: https://link.springer.com/article/10.1186/s40594-020-00222-7
- van Gog et al., 2011: https://doi.org/10.1016/j.cedpsych.2010.10.004

research evidenceはrigid prose templateやuniversal sentence-length thresholdを正当化するためではない。target reader、segmentation、worked-example depth、verificationをeditorial review対象にする根拠として限定利用する。
