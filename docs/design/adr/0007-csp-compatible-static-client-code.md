---
status: proposed
date: 2026-08-25
owner: architecture
---

# ADR-0007: CSP と両立する static client code を標準とする

## Context

既存 site は BaseLayout に hand-written inline JavaScript を持つ。strict CSP を static asset response へ適用する場合、無制限な inline script 許可は defense-in-depth を弱める。

request ごとの CSP nonce を発行するためには dynamic response path が必要になり、static-first architecture の単純性を失う。

Cloudflare Workers Static Assets は `_headers` から CSP 等の custom header を配信できる。

## Decision

- CSP を vNext security baseline に含める。
- CSP nonce のためだけに Worker runtime を導入しない。
- site-owned client behavior は可能な限り build asset / module へ分離する。
- `unsafe-eval` を許可しない。
- `unsafe-inline` を恒久 policy としない。
- unavoidable inline script は build-time hash 等、static deployment と整合する方式を採用できる。
- third-party script を導入する場合、必要 origin だけを CSP に追加する。

## Alternatives

### CSP を導入しない

静的サイトでも dependency / third-party / content injection の browser-side risk は残るため不採用。

### `script-src 'unsafe-inline'` を許可する

migration 初期の一時手段にはなり得るが、inline injection を広く許すため target としない。

### nonce 発行 Worker を全 route に置く

CSP だけのために dynamic runtime と operational surface を追加するため不採用。

## Consequences

- BaseLayout 等の inline script は frontend migration 時に責務別 module へ整理する。
- security header / CSP validation が CI / production smoke の対象になる。
- third-party script の導入は performance だけでなく CSP / privacy review も要求する。

## Evidence

- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
