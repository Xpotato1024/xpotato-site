---
status: proposed
date: 2026-08-29
owner: architecture
---

# ADR-0030: Frozen Astro/React island `uid` may be treated as bounded generated metadata variance

## Status boundary

This ADR is a **post-Freeze proposal**. It is not accepted by the 2026-08-29 ADR-0028/0029 amendment acceptance and does not expand `legacy-build-equivalence-v1` until a fresh clean-room design audit passes and the operator explicitly accepts this amendment.

The current machine comparator must continue to reject `uid`-only differences until that acceptance and a later separate implementation change.

## Context

ADR-0028 was accepted with only three permitted legacy ordering variance classes. During its implementation, GitHub-hosted clean reproduction exposed a fourth, structurally different variance in the frozen legacy React Tool.

Frozen legacy identity remains:

```text
repository: Xpotato1024/xpotato-site
tag: legacy-pre-vnext-2026-08-28
tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
commit: 927d105713561309fc5e2374396f86646b5aeb2a
package-lock blob: bb805f8a5558bf1eebe6d57d8292f7f69cb06d5a
```

The legacy package locks/declares:

```text
astro: 5.18.1
@astrojs/mdx: 4.3.14
@astrojs/react: 4.4.2
```

The interactive source is `src/content/tools/prime-factorizer.mdx` and contains one React island:

```mdx
<PrimeFactorizer client:visible />
```

### Hosted observation

ADR-0028 implementation reproduction run `33202767569` on head `ba69ab35f12678ac0323e27d1979a7720f59d4f4` produced two clean builds with:

```text
raw manifest 1: 983556da25735567d2cf5b30905096323b1fead188fe5b009d483f4b3f8084b4
raw manifest 2: 91ab85648158ee73b350f23c9d724b341b0aff6f8884a845763aebf7273c83b3
endpoint digest: 3bdb9ced87a60ee4bb9d52c680b274ba1ed8438e813fd7d0c09ee5e39879fd92
non-HTML digest: 2dc8ca780cab874fce931dfe227f2326498bf89788a80676e706b48efc8214c6
```

The accepted ordering comparator positively handled the observed Blog ordering permutations. The remaining failure was `tools/prime-factorizer/index.html`.

The generated Tool HTML was byte-identical except for the value of the single Astro island `uid` attribute, observed in that run as:

```text
uid="ZPqW8H"
uid="19OE8f"
```

The comparator correctly rejected this because ADR-0028 did not authorize a generated-metadata variance class.

## Exact upstream evidence

The relevant upstream source is version-pinned rather than inferred from current Astro behavior.

### Astro 5.18.1

Tag `astro@5.18.1` resolves to upstream commit:

```text
434d9cc7eed62e6324bd922865f5c29136f3474c
```

At that commit, `packages/astro/src/runtime/server/hydration.ts` places `astroId` into the generated island as `uid` and explicitly comments that the field is for HMR and likely avoidable in production.

At the same commit, `packages/astro/src/runtime/server/render/component.ts` computes `astroId` as a short hash over component export, pre-resolution component URL, rendered SSR HTML, and serialized props before `generateHydrateScript()` emits the final island.

At the same commit, `packages/astro/src/runtime/server/astro-island.ts`, which defines the browser custom element used for hydration, never reads `uid`. It loads component/renderer modules and hydration metadata from other explicit attributes.

### React integration 4.4.2

Tag `@astrojs/react@4.4.2` resolves to upstream commit:

```text
7a5f28006e9b1f6ad77c7884991ba551ca9ff35b
```

Its `packages/integrations/react/src/client.ts` hydrator never reads the island `uid`. Hydration uses the element itself, SSR state, props/slots, React state, and React-specific attributes such as `prefix` where applicable.

Therefore, for this exact frozen dependency/runtime class, `uid` is generated internal metadata rather than an input consumed by the production Astro island runtime or React hydrator.

## Decision proposal

Propose one additional bounded variance class under the existing `legacy-build-equivalence-v1` profile:

```text
astro-react-island-uid-v1
```

It permits only the **value** of an already-present `uid` attribute on a positively identified frozen Astro 5.18.1 + React 4.4.2 island to differ between clean builds.

It is not a generic attribute-normalization rule.

## Positive proof requirements

A `uid` difference is equivalent only when all of the following are proven:

1. Both documents contain the same number of Astro islands in the same DOM positions.
2. The compared elements are both exactly `astro-island` elements.
3. Both elements contain a non-empty `uid` attribute; only the attribute value may differ.
4. Every other island attribute is byte-identical, including any present:
   - `component-url`;
   - `component-export`;
   - `renderer-url`;
   - `props`;
   - `ssr`;
   - `client`;
   - `opts`;
   - `before-hydration-url`;
   - transition/action/React metadata;
   - any future/unexpected attribute.
5. The complete child/SSR HTML inside the island is byte-identical.
6. The surrounding page bytes are otherwise identical after independently proven ADR-0028 tie-equivalent sequence regions are accounted for.
7. The interactive inventory resolves the island to the frozen React Tool binding and the hydration directive remains `client:visible` for the initial snapshot.
8. The non-HTML manifest is byte-identical, so the referenced component and renderer assets are the same exact bytes in both builds.
9. Reproduction remains bound to the exact frozen package-lock/toolchain identity.
10. The comparison evidence records both observed raw `uid` values; it never synthesizes a replacement historical value.

If island identity, framework/renderer, position, children, any other attribute, asset bytes, or source/toolchain binding cannot be proven, comparison fails closed.

## Scope of initial class

The initial accepted candidate is intentionally constrained to the frozen PrimeFactorizer React island represented by the exact legacy inventory:

```text
component: src/components/app/PrimeFactorizer.tsx
used by: tools:prime-factorizer
framework: React
hydration: client:visible
```

This is a semantic/runtime constraint, not a list of HTML filenames allowed to differ. A future island or renderer does not inherit this exception automatically.

## Evidence implications

A later implementation may extend reproduction evidence with a field equivalent to:

```ts
interface PermittedGeneratedMetadataVariance {
  kind: "astro_react_island_uid";
  path: string;
  islandOrdinal: number;
  componentUrl: string;
  rendererUrl: string;
  client: string;
  observedValues: [string, string];
}
```

The raw dist manifests remain preserved. `rawByteIdentical` remains false when `uid` values differ.

The comparator may construct a comparison-only representation after positive proof, but must not rewrite either generated HTML artifact or present a normalized artifact as historical output.

## Failure semantics

The comparison remains `FAIL` when:

- an island is added/removed/reordered;
- `uid` is present on only one side;
- any non-`uid` island attribute differs;
- SSR children differ;
- component/renderer assets differ;
- the island is not the exact supported frozen React binding;
- hydration directive changes;
- dependency/source identity changes;
- more than the positively proved attribute value is normalized;
- extractor matching is ambiguous;
- any unexpected variance remains.

## Alternatives

### Ignore every `uid` attribute globally

Rejected. Other framework adapters or future Astro versions may assign semantics to generated identifiers. The evidence here is specific to the exact frozen Astro/React runtime.

### Treat the Tool as unreproducible forever

Safe but unnecessarily stronger than the observed production semantics. Exact upstream code and raw artifact comparison show a bounded generated-metadata difference while the executable/runtime inputs remain identical.

### Modify the frozen legacy source or dependency

Rejected because it changes the artifact being reproduced.

## Consequences

- raw output identities remain truthful;
- PrimeFactorizer reproduction can be judged by production-relevant equivalence without hiding arbitrary HTML changes;
- the exception remains tied to exact frozen framework/runtime evidence;
- any new generated-metadata class still returns to design review.

## Related

- `../../contracts/legacy-build-reproduction-contract.md`
- `../../contracts/legacy-build-astro-island-uid-amendment.md`
- `../../migration/legacy-freeze-2026-08-28.md`
- `../../architecture/design-status.md`
- `../../design/amendment-acceptance-2026-08-29.md`
- `0028-legacy-build-reproduction-equivalence.md`
