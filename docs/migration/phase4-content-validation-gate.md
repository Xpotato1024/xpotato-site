# Phase 4 Content Validation Gate

This file records the final repository-controlled validation pass for Phase 4 content materialization.

The gate requires:

- exact frozen legacy source and ContentId-map binding;
- complete materialization-report coverage;
- active vNext target files for every `migrate` disposition;
- collection-schema and portable-MDX conformance;
- repository, Astro, build, search, static, CSP, and migration checks;
- no legacy deletion, provider mutation, deployment, or cutover.

A fresh read-only Phase 4 audit is still required before merge.
