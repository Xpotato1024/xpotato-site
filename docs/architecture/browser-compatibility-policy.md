---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - browser compatibility policy
---

# Browser Compatibility Policy

## Default support model

個別 browser version の固定リストを長期 SoT とせず、Web Platform Baseline を compatibility 判断の標準 signal とする。

通常の必須機能は `Baseline Widely available` を第一候補とする。

`Newly available` または `Limited availability` の機能は、利用者価値が明確で、fallback / progressive enhancement / graceful degradation を設計できる場合だけ採用する。

Baseline は accessibility、performance、assistive technology、embedded WebView 等を保証しないため、それらの test を代替しない。

## Progressive enhancement

content、navigation、主要 action は、装飾的または補助的 JavaScript / CSS feature が失敗しても利用できることを原則とする。

例:

- article body は JavaScript 無効でも読める。
- primary navigation は native link semantics を維持する。
- animation / View Transition が使えなくても情報を失わない。
- clipboard enhancement が失敗しても code 自体は選択・コピーできる。

## JavaScript syntax / APIs

browser-only API を使う場合は:

- Baseline status を確認する。
- feature detection を優先し、user-agent sniffing を避ける。
- optional enhancement なら API 不在時は機能を無効化する。
- required interaction なら supported fallback を用意するか feature adoption を見送る。

## CSS

modern CSS は使用できるが、layout / readability が limited-availability feature 1つに依存しないようにする。

`@supports` 等の feature query が有効な場合は使用する。

## Testing

代表 route は少なくとも desktop / mobile viewport で確認し、material browser-specific feature を追加した PR では、対象 core browser family の compatibility evidence を残す。

実際の利用者 telemetry が将来得られた場合は、Baseline policy より具体的な support decision の evidence として利用できる。

## Sources

- MDN Baseline compatibility: https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility
- web.dev Baseline: https://web.dev/baseline
