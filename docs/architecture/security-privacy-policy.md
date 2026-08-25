---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - browser security policy
  - third-party client code policy
  - privacy baseline
---

# Security and Privacy Policy

## Threat model baseline

static site で server-side attack surface は小さいが、browser-side code、third-party JavaScript、dependency supply chain、raw HTML、external asset、misconfigured headers は依然 attack surface である。

「静的サイトだから security policy 不要」としない。

## Security headers

Cloudflare Workers Static Assets の `_headers` を application-level security header の標準配布経路とする。

vNext implementation で少なくとも次を設計・検証する。

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame embedding control (`frame-ancestors`)

HSTS 等の zone / origin-wide policy は `Xpotato-Server` の infrastructure ownership と整合させ、同じ設定を複数箇所で競合させない。

## Content Security Policy

CSP は defense-in-depth として導入する。

static-first design では request ごとの nonce を生成するためだけに Worker runtime を追加しない。

vNext target:

- hand-written inline JavaScript を減らし、build asset へ分離する。
- `unsafe-eval` を許可しない。
- `unsafe-inline` を恒久解決として使わない。
- unavoidable inline content がある場合は build-time hash 等、static deployment と整合する方式を検討する。
- third-party origin は必要な directive に最小限 allowlist する。

CSP 導入時は report-only / representative route test を使い、機能を壊したまま強制しない。

## Raw HTML / XSS boundary

新規 publishing path で unsanitized external HTML を `set:html` へ渡さない。

legacy imported HTML は migration debt として範囲を把握し、通常 article authoring から隔離する。

user-supplied content を将来受け付ける場合、static author-controlled content と同じ trust model を再利用せず別 architecture review を行う。

## Third-party JavaScript

analytics、ads、embed、tag manager、chat widget 等は default-off。

導入時は少なくとも:

- business / reader purpose
- data sent to third party
- execution privilege / supply-chain risk
- CSP origin expansion
- performance impact
- consent / disclosure requirement
- failure / blocking behavior

を評価する。

可能なら third-party script より static link / image / privacy-preserving alternative を優先する。

SRI が適用可能な immutable external resource では利用を検討するが、SRI だけを third-party risk の完全対策とみなさない。

## Privacy baseline

vNext baseline では、サイト application 自身が account、session、behavior profile、personal form submission を収集することを前提にしない。

tracking / analytics / advertising を追加する場合は収集 data、retention、third party、consent / policy 表示を先に定義する。

不要な browser permission を要求しない。Permissions-Policy で未使用 capability を制限する。

## External links

external link 自体に blanket `target=_blank` を要求しない。

新しい browsing context を開く場合は opener isolation を current browser semantics と合わせて確認する。

## Dependency supply chain

client / build dependency の追加は `dependency-policy.md` に従う。

lockfile を使用し、CI install を reproducible にする。security advisory 対応は framework major の放置と分離して扱う。

## Validation

- production headers
- CSP violation / blocked resource
- raw HTML boundary
- third-party origin inventory
- client dependency / script inventory
- secret / private info publication scan

を representative route で確認する。

## Sources

- Cloudflare Workers Static Assets custom headers: https://developers.cloudflare.com/workers/static-assets/headers/
- MDN Content Security Policy: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Third Party JavaScript Management: https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html
