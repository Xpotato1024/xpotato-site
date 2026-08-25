---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - frontend performance policy
  - accessibility target
---

# Performance and Accessibility Policy

## Performance objective

実ユーザー指標では Core Web Vitals の good threshold を p75 で満たすことを target とする。

- LCP <= 2.5 s
- INP <= 200 ms
- CLS <= 0.1

mobile / desktop を分けて評価する。

この値は design preference ではなく外部指標の target であり、Google / web.dev の current definition が更新された場合は再確認する。

## Route classes

### Content route

blog / notes / static pages は原則として React hydration 0 を invariant とする。記事に明示的な interactive embed がある場合のみ例外とする。

### Index / discovery route

filter / search が static data と CSS / minimal JS で足りる場合、framework hydration を導入しない。大量 client rendering を避ける。

### Interactive tool route

必要な island だけを page-local chunk として配信する。他ページへ tool bundle を漏らさない。

## Performance budget

初回 vNext implementation では、現行 site を測定して baseline artifact を保存してから route class ごとの budget を設定する。根拠なく KiB 上限を決めない。

ただし次は baseline 前から invariant とする。

- content-only route へ React runtime を送らない。
- third-party script は明示承認なしに追加しない。
- image / iframe は layout dimension を事前確保する。
- below-the-fold image は原則 lazy load。
- LCP candidate を不必要に lazy load しない。
- build artifact size と client JS の route 別差分を CI で観測可能にする。

budget は一度決めた後、増加を黙って追認せず、差分理由を PR に残す。

## Images

build-time optimization の恩恵を受ける site-owned image は Astro image pipeline で扱える source location を優先する。

`public/` は transformation を不要とする passthrough file、favicon、robots、redirect artifact 等へ寄せる。

R2 は大容量 / 配布用 / 増加量が大きい asset に使用する。content と結び付く R2 key は immutable / versioned を原則とする。

画像は intrinsic size または aspect ratio を持ち、unexpected layout shift を防止する。responsive image を優先し、必要以上の pixel size を配信しない。

## Fonts

日本語本文は system font stack を default とする。日本語 web font は payload が大きくなりやすいため、brand requirement と実測根拠なしに導入しない。

導入時は subset / self-host / preload / fallback / CLS への影響を評価する。

## Motion

animation は transform / opacity を中心にし、layout thrashing を避ける。

`prefers-reduced-motion` を尊重し、motion を無効化しても情報・操作を失わない。scroll-linked ambient animation は content readability / battery / main-thread cost を測定し、装飾価値が低ければ削除する。

## Accessibility target

WCAG 2.2 Level AA を target とする。

最低限、以下を CI / manual review の組み合わせで確認する。

- semantic landmark / heading order
- keyboard-only operation
- visible focus
- accessible name / label
- text / UI contrast
- target size
- alt text / decorative image handling
- form error / status communication
- reduced motion
- zoom / responsive reflow

自動 test の通過だけを AA conformance とみなさない。代表 route は keyboard と screen-reader semantics を manual smoke する。

## Sources

- Core Web Vitals と accessibility 標準の provenance は `../references/external-sources.md` を参照する。
