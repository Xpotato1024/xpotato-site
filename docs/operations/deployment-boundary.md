---
status: proposed
owner: operations
last_verified: 2026-08-25
canonical_for:
  - deployment ownership boundary
---

# Deployment Boundary

## Site repository owns

`xpotato-site` は以下を所有する。

- source / content
- build definition
- `dist/` contract
- Wrangler の application-local static asset configuration
- site-local route / 404 / application path redirect
- public smoke check
- R2 object path convention used by content

## Infrastructure repository owns

`Xpotato1024/Xpotato-Server` は以下を所有する。

- Cloudflare account / zone current inventory
- DNS desired state
- shared R2 bucket resource lifecycle
- provider-level policy
- zone-level redirect / rule when application static routing cannot express it
- infrastructure secret / provider credential handling

サイト repo へ Cloudflare account ID / zone ID を canonical value として複製しない。

## Production target

vNext は Cloudflare Workers Static Assets へ static `dist/` を deploy する。

Cloudflare Pages と VPS static hosting を同時に active target として文書化しない。fallback / migration history が必要なら legacy / ADR に記録する。

## R2

現在 infrastructure inventory に `xpotato-assets` bucket が website public binary asset 用として存在する。bucket resource の存在・ID は infra SoT、content が使う logical path convention は site SoT とする。

R2 upload を article publishing の暗黙 side effect にしない。upload、availability check、content reference update の順序を explicit workflow として設計する。

## Redirect boundary

Static Assets の `_redirects` で表現できる path redirect は site repo。

query-string を identity とする WordPress legacy URL 等は static path redirect では表現できないため、provider-level redirect rule として infra repo が owner になる。

site content metadata は legacy identity を保持できるが、provider configuration の second source of truth にはしない。

## Credentials

GitHub agent / local authoring workflow が Cloudflare production credential を当然に持つ前提にしない。preview / build と production mutation の permission boundary を分ける。
