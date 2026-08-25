---
status: proposed
date: 2026-08-26
owner: content
---

# ADR-0011: Blog hero を必須化し、AI生成heroをnon-evidence visualとして扱う

## Context

software article は自然な hero photo を持たないことが多い。一方、archive、social card、site visual consistency のため article hero が必要である。

AI image generator は不足 visual を補えるが、fake UI / code / benchmark / screenshot を作ると記事 evidence と混同される。

## Decision

Blog publish candidate は hero visual を原則必須とする。

priority:

1. suitable source / real media
2. AI-generated conceptual illustration
3. deterministic design-system cover

AI-generated hero:

- article fact / evidence ではない
- fake screenshot / output / benchmark / factual diagram を default 禁止
- title textを画像モデルへ描かせない
- independent visual audit を必須とする
- provider / model / prompt hash / raw output hash / normalized hash を provenance として記録する
- public derivative の embedded metadata だけへ provenance を依存しない

OGP title / branding は必要なら deterministic social-card renderer で合成する。

## Alternatives

### hero がない記事を許容

運用は単純だが visual consistency / archive / social sharing の品質を毎回記事 source media に依存するため不採用。

### すべて deterministic cover

一貫性は高いが記事ごとの visual diversity が弱い。AI generation unavailable 時の fallback として保持する。

### すべて AI image

実写真や factual screenshot の方が有用な記事まで synthetic visual に置き換えるため不採用。

## Consequences

- image generation provider は optional dependency であり publication availability の single point of failure にならない。
- generated visual provenance / disclosure policy が必要になる。
- media normalization は camera privacy metadata と AI provenance metadata を区別する必要がある。
