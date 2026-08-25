---
status: supporting
owner: architecture
last_verified: 2026-08-26
canonical_for: []
---

# External Sources

この文書は vNext design の外部 provenance を集約する supporting reference であり、repository policy 自体の SoT ではない。

## Astro / static architecture

- Astro, Islands architecture: https://docs.astro.build/en/concepts/islands/
- Astro, Client directives: https://docs.astro.build/en/reference/directives-reference/
- Cloudflare Workers, Astro: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Astro 7.2 release: https://astro.build/blog/astro-720/

## Astro images / media

- Astro images: https://docs.astro.build/en/guides/images/
  - responsive `Image` / `Picture` and Markdown image behavior; `public/` images are not optimized.
- Apple HEIF / HEVC: https://support.apple.com/ja-jp/116944
  - iPhone High Efficiency media uses HEIF / HEVC and offers higher compression efficiency than JPEG / H.264.
- Sharp installation: https://sharp.pixelplumbing.com/install/
  - prebuilt binaries support JPEG, PNG, WebP, AVIF etc.; HEIC decode support must not be assumed from the default prebuilt set.
- Sharp output metadata: https://sharp.pixelplumbing.com/api-output/
  - default output behavior strips metadata unless explicitly preserved.
- Cloudflare Images limits and formats: https://developers.cloudflare.com/images/get-started/limits/
  - HEIC input supported; output supports AVIF / WebP / JPEG / PNG.
- Cloudflare Images transformations: https://developers.cloudflare.com/images/optimization/transformations/overview/

## Cloudflare static delivery / compression

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
  - default ETag / revalidation behavior; fingerprinted assets can use long immutable cache.
- Cloudflare content compression: https://developers.cloudflare.com/speed/optimization/content/compression/
  - Gzip / Brotli and optional Zstandard delivery.

## Browser compatibility

- MDN Baseline compatibility: https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility
- web.dev Baseline: https://web.dev/baseline

## Tailwind

- Astro styling guide: https://docs.astro.build/en/guides/styling/
- Deprecated `@astrojs/tailwind`: https://docs.astro.build/en/guides/integrations-guide/tailwind/

## Node

- Astro install prerequisites: https://docs.astro.build/en/install-and-setup/
- Node.js release status: https://nodejs.org/en/about/previous-releases
- Node 24 LTS migration/support note: https://nodejs.org/en/blog/migrations/v22-to-v24

## Web performance

- web.dev, Web Vitals: https://web.dev/articles/vitals
- web.dev, Optimize INP: https://web.dev/articles/optimize-inp
- web.dev, Client-side rendering and interactivity: https://web.dev/articles/client-side-rendering-of-html-and-interactivity

## Accessibility

- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C, WCAG overview: https://www.w3.org/WAI/standards-guidelines/wcag/

## SEO / discovery

- Google Search Central canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search Central documentation updates: https://developers.google.com/search/updates

## Security / privacy

- Cloudflare Workers Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/
- MDN Content Security Policy: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JavaScript Management: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html

## Agent Skills

- Agent Skills specification: https://agentskills.io/specification
- Agent Skills GitHub specification: https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- Agent Skills best practices: https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx

## OSS writing Skill references

- inference-sh technical blog writing, registry overview: https://skillmd.com/plugins/skillmd/publish-technical-blog-post
- Mark-Life writing-for-readers: https://github.com/Mark-Life/agent-skills/blob/main/skills/communication/writing-for-readers/SKILL.md
- mazrean writing-technical-design: https://github.com/mazrean/agent-skills/blob/main/skills/writing-technical-design/SKILL.md

## Japanese readability / technical writing evidence

- Yuka Tateisi, Yoshihiko Ono, Hisao Yamada, “A Computer Readability Formula of Japanese Texts for Machine Scoring”, COLING 1988: https://aclanthology.org/C88-2135/
- Satoshi Sato, Suguru Matsuyoshi, Yohsuke Kondoh, “Automatic Assessment of Japanese Text Readability Based on a Textbook Corpus”, LREC 2008: https://aclanthology.org/L08-1230/

## Worked examples / programming instruction

- Margulieux et al., “Reducing withdrawal and failure rates in introductory programming with subgoal labeled worked examples”, International Journal of STEM Education, 2020: https://link.springer.com/article/10.1186/s40594-020-00222-7
- van Gog et al., “Effects of worked examples, example-problem, and problem-example pairs on novices’ learning”, Contemporary Educational Psychology, 2011: https://doi.org/10.1016/j.cedpsych.2010.10.004

研究 evidence は rigid prose template や universal sentence-length threshold を正当化するためではない。target reader、sentence complexity、segmentation、worked example depth を editorial review 対象にする根拠として限定して利用する。
