# Source access and rebuild directions

The source for our JS/WASM artifacts is provided through the repository source at the relevant branch/commit, together with the exact upstream source archives listed in the [artifact/source index](licensing/artifact-index.json). Access is immediate and at no additional charge. Source at an external server is part of the network-source arrangement described in AGPL/GPL section6(d); the maintainer remains responsible for keeping it available and providing a replacement copying facility if needed.

## What to obtain

1. Obtain the same repository commit as the artifact. Build receipts under native/ record the artifact hash, original input hashes, changes/patch scripts, compiler image and build command. Original source and our changes/scripts are included in that commit. The index links the current remote source snapshot and receipts; earlier experimental commits retain their own receipts.
2. Obtain the exact GMP, GMP-ECM or msieve source archives required by that receipt, from the direct official URLs in the indexed source manifests. Verify size and SHA-256 before use. Selected msieve sources already present under vendor/ are also source, with their original notices. Original upstream archives were materialized and hash-checked on the development PC; the maintainer retains verified copies for recovery. A URL/hash by itself does not replace the source tree, changes and build/relink scripts supplied here.
3. Rebuild using the receipt's scripts and pinned toolchain. Full SIQS uses scripts/fetch-reviewed-full-siqs.mjs and scripts/build-full-siqs.mjs; lab/tuned variants have corresponding scripts. GMP/tinyqs and candidate variants identify their scripts in sourceHashes. Read the branch native/ README and architecture source-review documents for configuration and linking boundaries. The same sources and build scripts allow rebuilding/relinking a modified application/library; no signing key or device authorization is required.
4. For rusqsieve comparison branches, obtain the exact crate and Rust components from their native/rusqsieve manifests. The branch includes the complete local patch/observer and RustDockerfile. Recreate the pinned toolchain from the verified components. A local Docker image ID is a producer receipt, not a registry image: on another machine substitute the locally recreated image identity in the build command and compare the resulting WASM hash. Preserve the original receipt; record a new local producer receipt for that rebuild.

## Source scope

GMP/ECM original source and selected/full msieve sources have distinct terms; the original license files and individual source notices govern them. Compiler/build-tool binary packages listed as bootstrap inputs are tools, not application source substituted for the library sources. Emscripten/musl/compiler-rt and Rust runtime notices are retained in the relevant branch. See [third-party boundaries](THIRD_PARTY_NOTICES.md).

The indexed source snapshot already contains the patches, scripts and source files needed for its artifacts. Source links and input receipts are offered together, rather than calling a bare list of hashes a completed source-delivery package. Branches that introduce another artifact must retain an equally explicit source mapping.

Availability is maintained by the repository owner. Report a broken source link through this repository's Issues so the retained verified copy can be made available at a replacement location; current source access does not depend on making such a request. This is an immediate network-access arrangement, not a deferred written offer or a promise that every experimental branch is a stable release.

The Stage18 DLP artifact is separately mapped by native/rusqsieve-dlp/staged-build.json and its README. The indexed immutable source snapshot includes both original and additional patch/build/runtime sources. It uses the same pinned original crate and Rust components, with no new upstream dependency; rebuild it with scripts/build-rusqsieve-dlp.mjs and scripts/build-dlp-worker.mjs. Original artifacts and their receipts remain available.

The Stage20 geometry artifact is separately mapped by native/rusqsieve-geometry/staged-build.json and its README. The indexed immutable source commit includes its exact native patch, observer, runtime and build scripts, together with all historical sources. It reuses the same pinned original crate and Rust toolchain without a new upstream dependency. Rebuild with scripts/build-rusqsieve-geometry.mjs, scripts/generate-geometry-runner.mjs and scripts/build-geometry-worker.mjs; preserve the original producer receipt when recreating the toolchain locally.

## Site package v0.1.0

The site package is built by scripts/build-site-release.mjs from the exact tagged source commit. It includes the selected normal staged path, optimized path and explicit selected-wide path, and their embedded Worker/WASM sources. The release page provides the complete repository source archive, license texts and the artifact hash; the site displays the fixed source commit and version. Third-party input source, local modifications and rebuild recipes remain available through the existing artifact/source index and native receipts. No signing key or service credential is required to rebuild or run a modified package.

The site archive includes both licensing/artifact-index.json (historical library inputs) and licensing/site-release-v0.1.0.json (the distributed embedded Worker/WASM mapping). Kernel-source links bind the preserved kernel commit; the adapter source is the exact v0.1.0 tag target recorded by GitHub Release and the site pin. Receipt paths resolve in that kernel commit.

## GUI candidate 0.1.1 (unreleased)

The candidate is mapped by licensing/site-release-candidate.json. Its adapter source is the exact reviewed candidate commit, not the v0.1.0 tag target. The preserved licensing/site-release-v0.1.0.json still maps unchanged embedded kernels and is historical for the old adapter. The candidate builder includes MUSL-COPYRIGHT.txt directly. No new release/site pin is established by preparing this source. Use the candidate source/release review for its exact commit and artifact hash.

## Compatibility release 0.1.2

The sections above and licensing/site-release-candidate.json preserve the original preparation history. The v0.1.2 tag and its RELEASE-PROVENANCE.json identify the exact current adapter source and distribution hash. The release provides the complete tracked repository source ZIP alongside the runtime ZIP, checksums and browser acceptance evidence. The selected kernels, their notices, source archives and rebuild/relink recipes remain mapped by licensing/site-release-v0.1.0.json and licensing/artifact-index.json; no kernel or numerical policy changes are introduced by 0.1.2. PR30 adds reproducible Firefox/WebKit acceptance tools and records. Version labels are aligned to 0.1.2. Site integration and deployment are separate from this repository release.

## Flat presentation release 0.1.3

For 0.1.3, use the exact v0.1.3 tag target and its RELEASE-PROVENANCE.json for the adapter source, runtime file hashes and complete tracked repository source ZIP. Earlier release tags/assets, source offers and kernel mappings remain historical records and are not overwritten. The release includes the accepted input/execution/result flow, example and settings dialogs, status and factor explanations, scoped styling tokens and manifest capability metadata, together with CI-only Node/Chrome startup verification. The selected numerical kernels, input/resource limits, dependencies and their rebuild/relink recipes are unchanged. Package, lock and adapter labels are aligned to 0.1.3. Preparing these sources does not publish a tag, admit a Site pin or deploy a host.

## Annotated-tag identity release 0.1.4

The v0.1.3 annotated tag is retained as an unpublished preparation record: its CI rejected the raw tag-object SHA against the peeled checkout commit before running dependencies/tests. No v0.1.3 GitHub Release or public assets were published. Version 0.1.4 preserves the same accepted GUI and numerical/runtime contracts, with explicit raw-tag/ref/peeled-commit CI identity checks and aligned package/adapter labels. Use the exact v0.1.4 tag target, complete tracked source ZIP and RELEASE-PROVENANCE.json for this distribution. Older tags and assets are not rewritten. Existing kernel license mappings and rebuild/relink recipes remain applicable.
