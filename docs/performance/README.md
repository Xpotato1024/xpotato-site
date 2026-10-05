# Performance verification

The acceptance criteria and tool comparison are in [ADR 0038](../design/adr/0038-measured-static-delivery.md). Asset budgets are explicit in `budget-v1.json`, checked by `npm run performance:check` after the single release build. This includes the static/search/code/Tool distinction; the Tool retains its existing React island.

The subsequent transparent-glass review candidate is documented in [ADR 0039](../design/adr/0039-transparent-glass-after-phone-review.md) and `glass-review-v1.json`: WebKit/Edge screenshots, actual patterned SVG-support experiment, sampled dark-photo text contrast and a same-condition home performance regression check. It is a transparent/reflected CSS approximation, not genuine spatial refraction in Safari. Physical iPhone appearance approval is still pending.

## Reproduce

Use the repository's pinned Node/npm toolchain. Run `npm ci`, then `npm run ci` with the release temporary-directory and browser environment documented by the release workflow. To check an existing build without rebuilding:

```sh
npm run performance:check
```

For a local mobile lab measurement, set `CHROME_PATH` to a local Chromium/Edge executable and `XPOTATO_RELEASE_TEMP` to an absolute writable temporary directory, then:

```sh
node scripts/performance-smoke.mjs apps/site/dist /absolute/temp/result.json
```

The script serves only the supplied local artifact on loopback, uses a temporary browser profile, disables cache, simulates 390×844/DPR1, 4× CPU, 150 ms latency and 200,000 B/s download, and repeats each route three times. HTML/CSS/JS/JSON/SVG use local gzip; images and WOFF2 are already compressed. Results record browser version, resource groups, LCP/CLS and limitations. The synthetic code-detail route exists only in the private review build, never as a public article.

`review-performance-v1.json` contains before/after observations and medians. The baseline is commit `d1c6f8770c8f08e3c5dc9614d111a7a315f63d83`; the after artifact uses this PR's performance implementation. Homepage photo measurements are explicitly private-review-only. Resource byte counts are encoded bodies, excluding HTTP header overhead. All original paths in evidence are public eligible routes or the clearly synthetic private detail route; there are no held article bodies or environment credentials.

## Optional offline font regeneration

The fixed code-point corpus is a reviewed optimization snapshot, not a publication inventory. Original fallback slices remain usable for new content; a corpus refresh is optional when eligible text expands. Search interface strings and eligible snippets are covered. Do not derive a new corpus from held article content.

Use CPython 3.12 on Windows x64 in an isolated temporary environment:

```sh
python -m pip install --require-hashes -r scripts/font-core-requirements.txt --target /absolute/temp/fonttools
# Set PYTHONPATH to that isolated directory.
python scripts/generate-font-core.py
```

The default command verifies byte-for-byte reproduction in a temporary directory. `--write` intentionally updates the four generated binaries, CSS and manifest after input review. Fonts are licensed under SIL OFL; source licensing is preserved. Python tools are not needed by the build, CI or browser.

## Private photo trial

```sh
node scripts/optimize-review-photo.mjs /private/source.jpg /absolute/temp/variants
```

Output must be inside the OS temporary root (or RUNNER_TEMP). The report includes source and derivative hashes, dimensions, bytes and Sharp/native-library versions. `SITE_PREVIEW_WORKSHOP=1` is only for an isolated private review build supplied with those local variants. Never enable it for a release build. Original photos and generated trial variants are not committed. Format fallbacks and composition are browser-checked before refreshing review screenshots.

The production image pipeline, storage and publication gates are unchanged. Future authorized images should use the existing hero/body profiles, explicit dimensions, eager high-priority loading only for the actual hero and lazy loading for body images. The budget enforces the rendered loading/dimension contract; it does not pretend to measure assets still held outside output.
