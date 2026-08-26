---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0014: Content mediaはR2-firstとしGitへ蓄積しない

## Context

写真・スクリーンショット・AI生成heroは記事数に比例して増える。一度Gitへcommitしたbinaryは後でarticleから削除しても通常のhistoryには残り、clone / fetch / CI / backupのmedia transfer costが継続する。

GitHubもlarge repositoryがfetch / clone / CIを遅くし、programmatically generated filesはobject storage等Git外へ置くことを推奨している。

## Decision

- 通常の記事mediaのpublic web masterはR2を標準storageとする。
- raw camera / generated originalはprivate storage / Article Job workspaceへ置き、public R2へ直接公開しない。
- GitはMDX、Media Asset Registry、hash / dimensions / provenance reference、small site assetだけを保持する。
- Git LFSをcontent mediaのbaselineにしない。
- MDXはR2 URLではなくlogical asset IDを参照する。
- R2 masterはimmutable / versioned keyを使用する。
- responsive deliveryはCloudflare Images Transformationsをpreferred adapterとし、pregenerated R2 variantsをfallbackとして許可する。

## Alternatives

### Article imageを`src/assets`へcommitしAstro buildで最適化

小規模では単純だが、repository historyとbuild artifactが画像数に比例して成長するため長期defaultとして不採用。

### Git LFS

Git repository本体のobject肥大化は避けられるが、LFS client / quota / fetch workflowが追加され、公開object deliveryとは別planeになる。content mediaは最初からR2で管理する方が単純なのでbaselineにはしない。

### Cloudflare Images hosted storage

fully managedだが、R2 already provides object-storage lifecycle control and can be combined with Images Transformations. architectureはR2 masterを選ぶ。

## Consequences

- clone / CI sizeを記事写真数から分離できる。
- article authoringにはlogical media resolverが必要になる。
- local/offline previewにはremote R2 accessまたはfixture/cache strategyが必要になる。
- R2 object integrity / availability validationがpublication gateへ加わる。
- provider storage stateは`Xpotato-Server`側SoTと連携する。
