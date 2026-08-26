---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - cross-repository infrastructure design binding
  - website Cloudflare ownership handoff
---

# Infrastructure Handoff

## Purpose

`xpotato-site`が所有しないCloudflare/R2/provider designをmutable branch名や過去chatで補完せず、clean-room audit可能なexact `Xpotato-Server` revisionへbindする。

## Current proposal counterpart

```yaml
repository: Xpotato1024/Xpotato-Server
revision: 6d0a4e0ce0f88c1c1753beed9ceabbf3131e2b6d
adr: docs/decisions/ADR-0024-website-cloudflare-control-plane-and-media-protection.md
adr_status: Proposed
global_design_status: FROZEN
website_vnext_subgate: OPEN / provider mutation BLOCKED
```

Branch navigation hint:

```text
codex/site-vnext-cloudflare-control-plane
```

**branch headはauthorityではない。上記revisionだけがこのsite design revisionのcounterpart evidence。**

## Meaning

Counterpart ADR-0024 is still Proposed。

Therefore site documents may specify provider-neutral/application requirements but must not claim:

- proposed website R2 resource names are active desired values;
- provider mutation is authorized;
- ADR-0024 is accepted current infrastructure;
- current production Cloudflare state already matches vNext target。

Infra remediation removed proposed website vNext exact values from active `inventory/desired/cloudflare.yaml` until acceptance。

## Ownership split

### xpotato-site

owns:

- content/application semantics
- Worker deploy artifact and application-local Wrangler config
- logical media source/public/protection contracts
- object identity/hash/cache requirements
- Article Job publication/protection gates
- redirect requirements originating from content migration

### Xpotato-Server

owns:

- Cloudflare account/zone/DNS/provider resource facts
- Worker public-domain binding
- R2 resource names/actual configuration
- provider-level redirects/rules
- provider credentials/trust boundaries
- source/public/protected media provider implementation
- restore/drift/read-back operations

## Update rule

If counterpart design changes materially:

1. update `Xpotato-Server` proposal;
2. obtain exact new commit SHA;
3. review cross-repo semantics;
4. update this file to that SHA in the same site design change;
5. rerun affected clean-room audit。

Never update only the branch name。

## Acceptance transition

When ADR-0024 is later accepted/merged:

- replace this proposal revision with exact accepted/merged infrastructure revision;
- record accepted ADR status;
- verify machine desired values were promoted only after acceptance;
- rerun cross-repo clean-room audit before provider activation/cutover。

Provider/account IDs or secrets are never copied here。
