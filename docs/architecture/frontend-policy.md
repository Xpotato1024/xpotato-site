---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - frontend framework policy
  - React hydration policy
  - CSS policy
---

# Frontend Policy

## 原則

HTML first、CSS second、JavaScript only when required とする。

Astro の island architecture を利用し、静的 UI と interactive UI の境界を component 単位で明示する。

## Component selection

優先順は次の通り。

1. semantic HTML + Astro component
2. CSS だけで解決できる interaction / presentation
3. 小規模な vanilla TypeScript progressive enhancement
4. React island

React を「UI component を書く標準言語」とはしない。React は local state、複数 event、複雑な derived UI、既存 React ecosystem の価値が runtime cost を上回る interactive feature に使用する。

現在の PrimeFactorizer のような stateful browser tool は React island の適切な用途である。一方、header、footer、navigation、article、card、table of contents の通常表示を React 化しない。

## UI framework count

client UI framework は React 1種類に限定する。Vue、Svelte、Preact 等を併用する場合は、bundle / maintenance cost を上回る具体的理由を ADR で示す。

## Hydration policy

- no `client:*`: default。静的出力。
- `client:load`: first viewport で即時 interaction が必要な要素に限る。
- `client:idle`: 初期表示を阻害しない低優先 interaction。
- `client:visible`: below-the-fold tool / widget の標準候補。
- `client:media`: media condition 自体が hydration requirement の場合。
- `client:only`: server / build rendering が不可能な browser-only dependency に限り、理由を code comment または設計文書に残す。通常は禁止。

hydration directive は「動いたもの」を選ぶのではなく、最も遅く読み込める directive を選ぶ。

## Navigation

通常の browser navigation を default とする。サイト全体の ClientRouter / SPA-like navigation は導入しない。

transition が必要な場合、まず CSS / native View Transition の適用可能性を検討する。Astro client router を導入する場合は、accessibility、history / scroll、script lifecycle、analytics、bundle cost を計測し ADR を作る。

## JavaScript organization

site-wide inline script へ unrelated behavior を集約しない。

- code copy
- menu
- reveal
- motion
- tool interaction

などを責務ごとに分け、対象ページ / component でのみ配信する。global script は全ページで必要な最小処理に限定する。

## CSS / design tokens

Tailwind CSS 4 を utility layer として使用し、公式 Vite plugin を使う。

色、spacing、radius、typography、elevation、motion duration など反復する design decision は CSS custom properties / Tailwind theme token へ集約する。

- repeated magic value を component 間でコピーしない。
- CSS-in-JS runtime を追加しない。
- utility class が読みにくいほど複雑な component は component-local CSS / semantic class へ分離してよい。
- design token は visual language の SoT、component class は usage とする。

## Third-party client code

analytics、ads、embeds、chat、A/B testing 等の third-party JavaScript は default-off とする。

導入時は purpose、privacy、blocking behavior、bundle / network cost、consent requirement、failure behavior を評価する。

## Accessibility in component design

semantic element、keyboard operation、focus visibility、reduced motion、label / accessible name を component definition の一部として扱う。視覚デザイン後に追加する補修作業にしない。

詳細 target は `performance-accessibility-policy.md` を参照する。
