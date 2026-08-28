---
status: proposed
owner: architecture
last_verified: 2026-08-29
canonical_for:
  - proposed Astro React island uid equivalence amendment
---

# Legacy Build Astro/React Island UID Equivalence Amendment

## Amendment status

This is a **post-Freeze proposed amendment** associated with ADR-0030. It is not accepted by ADR-0028 or the 2026-08-29 ADR-0028/0029 acceptance record. The current machine comparator must reject this variance until a fresh clean-room design audit passes, the operator explicitly accepts ADR-0030, and a separate implementation change is made.

## Parent contract

Parent accepted semantics:

- `legacy-build-reproduction-contract.md`
- profile `legacy-build-equivalence-v1`

This proposal adds one generated-metadata sub-class without changing the parent requirements for exact source identity, endpoint equality, non-HTML byte equality, or positive proof of all HTML variance.

## Proposed class

ID:

```text
astro-react-island-uid-v1
```

The class permits only a different **value** for a pre-existing `uid` attribute on the exact frozen Astro/React island described below.

## Frozen runtime scope

```text
legacy repository: Xpotato1024/xpotato-site
legacy tag: legacy-pre-vnext-2026-08-28
legacy tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
legacy commit: 927d105713561309fc5e2374396f86646b5aeb2a
legacy package-lock blob: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
Astro: 5.18.1
@astrojs/mdx: 4.3.14
@astrojs/react: 4.4.2
interactive component: src/components/app/PrimeFactorizer.tsx
legacy content identity: tools:prime-factorizer
framework: React
hydration directive: client:visible
```

The class is not automatically valid for another Astro version, another renderer, another component, another hydration directive, or another legacy snapshot.

## Equivalence proof

For each candidate `uid` variance, the deterministic comparator must prove all of:

1. Same number of `astro-island` elements in both pages.
2. Same island ordinal/DOM position.
3. Same positive interactive-inventory binding to the exact frozen PrimeFactorizer React component.
4. Both islands contain a non-empty `uid` attribute.
5. Removing only the `uid` **value** from the comparison representation makes the island start tag otherwise byte-equivalent; the attribute itself is not added/removed.
6. Every non-`uid` attribute is exactly equal by name/value and multiplicity. Unknown attributes are not dropped.
7. Exact same `component-url`, `component-export`, `renderer-url`, `props`, `ssr`, `client`, `opts` and every other emitted island attribute.
8. Exact same complete SSR child HTML.
9. Exact same page content outside the island after any separately proven ADR-0028 tie-equivalent sequence comparison.
10. Exact same non-HTML artifact manifest, including component/renderer JavaScript bytes.
11. Exact same frozen tag/commit/lock/toolchain identity required by the parent contract.
12. Both observed raw `uid` values are preserved in evidence.

If any proof cannot be established, the result is `FAIL`.

## Why this metadata is bounded

For the exact frozen versions:

- Astro 5.18.1 server hydration code emits `uid` from an internally computed `astroId` and documents it as HMR-oriented metadata;
- the Astro 5.18.1 browser `AstroIsland` custom element does not read `uid` during production hydration;
- the React 4.4.2 client hydrator does not read `uid`;
- component loading, renderer loading, serialized props, client directive, options and SSR children use other explicit attributes/bytes that remain exact under this amendment.

The amendment therefore treats the observed `uid` value as non-consumed generated metadata only inside this exact runtime/binding proof.

## Machine evidence

A future accepted implementation should record every admitted variance, for example:

```ts
interface AstroReactIslandUidVarianceEvidence {
  kind: "astro_react_island_uid";
  path: string;
  islandOrdinal: number;
  componentPath: "src/components/app/PrimeFactorizer.tsx";
  framework: "React";
  hydrationDirective: "client:visible";
  componentUrl: string;
  rendererUrl: string;
  observedValues: [string, string];
}
```

Equivalent field naming is permitted, but evidence must remain enough to re-evaluate the positive proof later.

## Prohibited implementations

Do not implement any of the following:

- `html.replace(/uid="[^"]+"/g, ...)` over arbitrary HTML;
- global deletion of `uid` attributes;
- a filename allowlist whose contents are automatically trusted;
- DOM serialization that discards unknown attributes or changes unrelated whitespace/content;
- acceptance when `component-url`, renderer, props, client directive, children, position or asset bytes differ;
- acceptance for Preact/Vue/Svelte/Solid or later Astro without another explicit design review;
- modification of the frozen legacy source or output to manufacture equality.

## Current observed evidence

Hosted reproduction run `33202767569` observed:

```text
raw dist SHA 1: 983556da25735567d2cf5b30905096323b1fead188fe5b009d483f4b3f8084b4
raw dist SHA 2: 91ab85648158ee73b350f23c9d724b341b0aff6f8884a845763aebf7273c83b3
endpoint SHA: 3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92
non-HTML SHA: 2dc8ca780cab874fce931dfe227f2326498bf89788a80676e706b48efc8214c6
Tool observed uid values: ZPqW8H / 19OE8f
```

This is evidence motivating the proposal, not an accepted PASS result.

## Related

- `../design/adr/0030-astro-react-island-uid-equivalence.md`
- `legacy-build-reproduction-contract.md`
- `../design/amendment-acceptance-2026-08-29.md`
