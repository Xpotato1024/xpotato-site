---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - design system architecture
  - design token ownership
---

# Design System Policy

## Purpose

visual redesign を component ごとの ad-hoc styling にせず、意味のある token と再利用可能な layout / UI primitive に落とし込む。

この文書は具体的な色や typography scale をまだ決めない。それらは visual design phase で決定し、machine-readable token を正本とする。

## Token layers

### Foundation tokens

raw palette、spacing step、font family、font size、radius、shadow、duration 等の基礎値。

### Semantic tokens

`surface`、`text-primary`、`text-muted`、`border`、`accent`、`danger`、`focus` 等、用途を表す値。

component が raw palette value を直接大量参照するより semantic token を優先する。

### Component-specific values

本当に component 固有で再利用されない値は local に保持できる。1回しか使わない値まで無理に global token 化しない。

## Machine-readable SoT

採用後の exact token value は CSS custom properties / Tailwind theme configuration を正本とする。

architecture prose に hex、px 等を複製して第二の value SoT を作らない。

## Component hierarchy

概ね次の層で責務を分ける。

- layout primitives: container、stack / cluster、section spacing
- UI primitives: button、chip、card shell、focus treatment
- content patterns: article header、metadata、TOC、related content
- page composition: Home、Blog archive、Project、Tool

抽象 component を増やすこと自体を目的にしない。2つの見た目が似ていても意味・behavior が異なる場合は無理に統合しない。

## Content typography

article prose と application chrome の typography / spacing を分離する。

`prose` layer は heading、paragraph、list、code、table、blockquote、figure を一貫して扱い、article ごとの MDX で presentation class を大量記述させない。

## Responsive design

mobile-first を基本とし、breakpoint は特定 device 名ではなく layout が破綻する content-driven point として選ぶ。

固定幅 device を前提にせず、narrow viewport、zoom、長い日本語 / 英語 identifier を含む content で確認する。

## Motion

motion は semantic role を持つ場合に使用し、duration / easing は token 化する。

- feedback
- state transition
- hierarchy / spatial continuity

単なる ambient effect は performance / distraction cost を上回る価値がある場合のみ残す。

`prefers-reduced-motion` を必須 boundary とする。

## Themes

light / dark theme の数を architecture requirement として先に増やさない。

複数 theme を導入する場合は semantic token で切り替え、component ごとの色分岐を避ける。

## Component library

外部 UI component library は baseline dependency にしない。

accessibility / maintenance / complex widget の再実装コストが高い具体的用途が出た場合だけ比較し、必要なら ADR を作る。

## Visual validation

visual redesign 後は representative route / viewport の screenshot regression または同等の visual evidence を CI / review workflow に組み込む。

pixel-perfect snapshot を無差別に増やさず、layout、typography、critical component の regression を検出できる粒度にする。
