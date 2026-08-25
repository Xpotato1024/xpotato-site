---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - vNext documentation source of truth map
---

# xpotato-site vNext Documentation

この `docs/` は、`xpotato-site` の次期構成を設計するための新しい documentation root である。

この設計段階では、既存の `README.md`、`doc/`、現在の実装を自動的に current SoT とみなさない。これらは移行元の実装・運用 evidence として参照できるが、vNext の仕様を決める根拠にはしない。

`docs/` の内容がレビューされて採用された後、ここを current architecture / governance の正本とし、実装をこの仕様へ段階的に収束させる。設計文書が存在することは、実装が既に適合していることを意味しない。

## Source of Truth Map

| Topic | Proposed canonical document | Role |
|---|---|---|
| 文書 governance | `architecture/documentation-sot-policy.md` | current / target / historical の分離 |
| システム構成 | `architecture/system-architecture.md` | build、runtime、Cloudflare、R2、infra boundary |
| frontend | `architecture/frontend-policy.md` | Astro、React、hydration、CSS、browser JS |
| performance / accessibility | `architecture/performance-accessibility-policy.md` | Core Web Vitals、budget、WCAG、media |
| content model | `architecture/content-architecture.md` | Content Collections、taxonomy、URL、legacy |
| dependency / toolchain | `architecture/dependency-policy.md` | Node、package、upgrade policy |
| editorial | `content/editorial-policy.md` | 日本語記事、根拠、記事構造 |
| development workflow | `operations/development-workflow.md` | branch、PR、変更単位 |
| validation | `operations/validation.md` | check、build、content / route / asset validation |
| deployment boundary | `operations/deployment-boundary.md` | site repo と Xpotato-Server の責務分離 |
| agent / Skill governance | `operations/agent-skill-governance.md` | AGENTS.md、Skills、scripts、CI の知識配置 |
| ADR | `design/adr/README.md` | 設計判断の履歴。current SoT ではない |
| legacy | `legacy/README.md` | 旧文書・旧実装の扱い |

## Document classes

- `architecture/`: 現在採用すべき target architecture と boundary。
- `content/`: 公開コンテンツの editorial / source policy。
- `operations/`: 反復利用する開発・validation・deployment contract。
- `design/adr/`: なぜその設計を選んだかを残す decision record。現在仕様は上記 canonical docs を読む。
- `references/`: 外部仕様・研究・一次資料への provenance。
- `legacy/`: 旧構成の inventory と移行上の注意。current design の根拠にしない。

## vNext の基本原則

1. static HTML first。動的機能を必要な局所へ閉じ込める。
2. Node.js は build toolchain に限定し、本番 runtime の前提にしない。
3. Astro component を通常 UI の標準とし、React は stateful な interactive island に限定する。
4. JavaScript、third-party code、web font、request-time runtime は必要性を示してから追加する。
5. content、route、asset、infra の owner を分離し、同じ値や意味を複数 repo / document に複製しない。
6. performance と accessibility はデザイン後の調整項目ではなく architecture constraint とする。
7. 設計判断は ADR、現在仕様は canonical docs、機械的に検査できる条件は CI / validator へ置く。

## Adoption gate

この proposed design を採用する前に、少なくとも次をレビューする。

- Astro static-first を維持すること
- React island の境界
- Tailwind 4 と design token の責務
- Cloudflare Workers Static Assets を公開面とすること
- Xpotato-Server との infra ownership
- content schema と legacy URL の扱い
- performance / accessibility target
- Agent Skills の責務分離

採用後は ADR の `status` を `accepted`、canonical docs の `status` を `canonical` へ更新してから実装 migration を開始する。
