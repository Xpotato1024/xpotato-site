---
status: canonical
owner: architecture
accepted_at: 2026-09-24
canonical_for:
  - post-Freeze ADR-0032 acceptance
  - vNext production deploy artifact determinism adoption
---

# Post-Freeze ADR-0032 Acceptance — 2026-09-24

## Decision

The operator explicitly accepted ADR-0032 on 2026-09-24 (`ADR-0032 Accepted です、マージも含めて進めてください`) after review of the fixed design/implementation candidate and its independent audit.

Reviewed and audited revision:

```text
repository: Xpotato1024/xpotato-site
audited_revision: 7686abd360c46775c4e9fbef7e3209af8ba43c63
fresh_read_only_audit: PASS — P0=0 / P1=0 / P2=0
operator_acceptance_date: 2026-09-24
```

The lifecycle-only acceptance commit that follows this audited revision may update ADR/status/index/acceptance metadata but must not broaden the implementation semantics without a new audit.

This acceptance adopts:

- ADR-0032 — deterministic vNext production deploy artifact identity;
- the bounded Astro 7.2.7 / @astrojs/react 6.0.4 / React 19.2.8 PrimeFactorizer UID canonicalization implemented at the audited revision;
- deterministic UTF-8 bytewise manifest ordering and `xpotato-site-deploy-tree-v1` length-delimited tree hashing;
- root build integration that canonicalizes before final search/static validation and manifest generation.

## Accepted exact artifact result

The audited candidate demonstrated:

```text
final file count: 32
outputTreeSha256:
8c2e1b5f00fa3caabc7403e9cb9f930ef157fa66f5d88bee7a3f3c973fadb252

same-path Windows repeat: PASS
different absolute Windows path: PASS
Windows vs Hosted Linux final artifact: PASS
exact-head hosted checks: 9/9 SUCCESS
```

The final 32 file sizes/SHA256 values and deterministic manifest bytes matched across the accepted proof environments.

## Boundary

ADR-0030 remains limited to frozen legacy Astro 5.18.1 / React integration 4.4.2 reproduction equivalence. ADR-0032 does not broaden that legacy exception.

The vNext canonicalization remains fail-closed on:

- runtime/dependency source/version changes;
- component/renderer asset changes;
- non-UID island attribute changes;
- SSR child or surrounding page byte changes;
- island count/position changes;
- unknown islands or ambiguous UID ranges.

Only the verified UID value byte range is rewritten.

## Separate unresolved Windows gate

Local Windows full `npm run ci` is **not PASS**. It currently stops in Phase 6 media processing regeneration with separate platform-dependent logical/image-byte differences. This acceptance does not classify that issue as fixed and does not generalize away historical Windows CRLF or Sharp/media divergences.

The canonical merge gate for the accepted ADR-0032 candidate remains the exact-head Hosted Linux workflows plus the explicit cross-platform final deploy-artifact proof recorded above.

## Authorization boundary

This acceptance and its repository merge do **not** authorize:

- Cloudflare provider mutation;
- JIT token issuance;
- production deployment;
- endpoint containment execution;
- R2/DNS/redirect mutation;
- publication-hold release;
- legacy cutover.

The earlier production authorization ended as `ABORTED_BEFORE_DEPLOY`. Any later production attempt requires a new explicit authorization naming the then-current exact Site revision and accepted Server authority revision, plus a fresh exact deploy artifact/preimage.

## Related

- `adr/0032-vnext-production-artifact-determinism.md`
- `../operations/build-artifact-pipeline.md`
- `../architecture/design-status.md`
- `adr/0030-astro-react-island-uid-equivalence.md`
