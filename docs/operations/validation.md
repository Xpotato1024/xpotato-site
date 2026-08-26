---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - validation strategy
---

# Validation

## Required CI baseline

すべての PR で少なくとも次を実行する。

1. reproducible dependency install (`npm ci`)
2. Astro / TypeScript check
3. production build
4. content / route / contract validator

exact command は implementation migration 後の `package.json` scripts を machine-readable entrypoint とし、この文書へ同じ command set を過剰複製しない。

## Contract validation

vNext implementationでは少なくとも次をschema / testで検査する。

- ArticleJobSpec canonical serialization / fingerprint
- Source / Evidence / Claim binding
- Blog frontmatter
- taxonomy registry
- content module registry
- visual plan / generation / audit record
- publication candidate / human approval

JSON SchemaをAI exchange用に生成する場合、hand-written duplicate schemaを正本にしない。

## Content validation

- schema validity
- category / tag registry validity
- duplicate route / slug
- broken local asset reference
- invalid canonical
- legacy redirect conflict
- raw legacy HTML の新規増加防止
- unknown MDX module
- Blog hero presence

## Article Job validation

semantic responseはprivate stagingへ受け取り、strict import validationが成功するまでcanonical artifactへ昇格しない。

- request fingerprint
- Skill snapshot
- response schema
- source / evidence refs
- draft / audit target SHA
- hero / visual audit target SHA
- candidate SHA
- human approval target SHA

のbindingを検証する。

AIのself-reported successをvalidation結果として扱わない。

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

## Media validation

- raw HEIC / HEIFをpublic assetとして新規追加していない
- GPS / private EXIFがnormalized derivativeに残っていない
- responsive variant生成
- hero origin / provenance
- AI-generated visualがvalid visual auditへbind
- social cardがactual title / categoryからdeterministicに生成

## Deployment validation

production deployment は build success だけで完了としない。

- canonical domain HTTP status
- representative content route
- representative interactive tool route
- 404
- robots / sitemap
- R2 asset if changed
- redirect if changed
- cache / compression header

public smoke は自動化可能なものを script / CI に移す。

## Validation ownership

人間の手順書だけで防げる invariant は、反復性が高ければ CI / validator へ昇格する。AGENTS.md や Skill に「忘れないこと」とだけ書いて終わらせない。
