---
status: proposed
owner: operations
last_verified: 2026-08-25
canonical_for:
  - validation strategy
---

# Validation

## Required CI baseline

すべての PR で少なくとも次を実行する。

1. reproducible dependency install (`npm ci`)
2. Astro / TypeScript check
3. production build
4. content / route validator

exact command は implementation migration 後の `package.json` scripts を machine-readable entrypoint とし、この文書へ同じ command set を過剰複製しない。

## Content validation

- schema validity
- category registry validity
- duplicate route / slug
- broken local asset reference
- invalid canonical
- legacy redirect conflict
- raw legacy HTML の新規増加防止

## Frontend validation

- content route に unintended hydration bundle がない
- interactive route の island が route-local である
- build output の JS / CSS / image size diff を取得する
- responsive layout smoke
- console error がない

## Performance validation

初回 migration PR で representative route の baseline を取得し、その後 budget を設定する。

budget gate は絶対値と差分を組み合わせる。小さな regression を毎回許容して閾値を徐々に押し上げない。

field Core Web Vitals は lab CI と同一ではないため、lab test の通過を field target 達成と同一視しない。

## Accessibility validation

自動:

- HTML / accessibility lint where practical
- representative route の automated audit

manual:

- keyboard navigation
- focus visibility
- menu / form / tool interaction
- reduced-motion
- zoom / narrow viewport
- heading / landmark semantics

WCAG 2.2 AA は automated scanner だけで証明できない。

## Deployment validation

production deployment は build success だけで完了としない。

- canonical domain HTTP status
- representative content route
- representative interactive tool route
- 404
- robots / sitemap
- R2 asset if changed
- redirect if changed

public smoke は自動化可能なものを script / CI に移す。

## Validation ownership

人間の手順書だけで防げる invariant は、反復性が高ければ CI / validator へ昇格する。AGENTS.md や Skill に「忘れないこと」とだけ書いて終わらせない。
