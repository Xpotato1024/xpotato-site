---
status: proposed
date: 2026-08-26
owner: architecture
---

# ADR-0010: AI-first authoring を Article Job pipeline として実装する

## Context

vNext は記事追加・更新を主要運用とし、通常記事は AI に初稿を作らせる前提になった。

単純な「prompt -> MDX write」では、source provenance、unsupported claim、model / Skill drift、自己監査、画像生成、human approval を追跡できない。

`video-evidence-pipeline` では fixed request、versioned artifact、independent audit、human gate、deterministic import を使って semantic AI と canonical workspace を分離している。

## Decision

- article production の unit を `Article Job` とする。
- AI semantic output は private response として受け、deterministic import validator を通す。
- source/evidence、draft、claim、audit、visual、candidate、approval を別 artifact にする。
- author と content auditor は fresh context を使う。
- automatic revision は bounded。
- human approval は exact candidate hash に bind する。
- AI は `src/content/` へ直接 canonical write しない。
- implementation は site runtime と分離した tool / CLI とする。

## Alternatives

### Agent に repository 全体を渡し直接記事 commit

簡単だが provenance / gate が弱く、model behavior に repository integrity が依存するため不採用。

### CMS workflow

human editor UI は提供できるが、AI-first artifact lineage と static MDX SoT を中心にした今回の目的に対して別 system を増やすため不採用。

### VEP を直接 dependency とする

artifact philosophy は適合するが video/media/transcription domain が大きすぎる。pattern を site domain へ縮小移植する。

## Consequences

- article generation は単発 prompt より実装量が増える。
- source / audit / approval の再現性と検証可能性が上がる。
- provider/model の置換が repository content contract と分離される。
- high-level runner で日常操作は簡略化できる。
