---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - interactive module registry
  - Tool content to runtime binding
---

# Interactive Module Registry Contract

## Goal

MDX contentとReact等のinteractive implementationを分離する。

content fileがcomponent source pathや`client:*` directiveを直接所有しない。

## InteractiveModuleRecord

```ts
type HydrationMode = "load" | "idle" | "visible" | "media";

type InteractiveFramework = "react";

interface InteractiveModuleRecord {
  id: string;
  framework: InteractiveFramework;
  componentId: string;

  hydration: HydrationMode;
  mediaQuery?: string;

  allowedCollections: Array<"tools" | "blog" | "notes" | "projects" | "pages">;
  role: "primary_tool" | "inline_demo";

  status: "active" | "retired";
  apiVersion: number;

  budgetClass: "small" | "medium" | "large";
}
```

`componentId`はarbitrary filesystem pathではない。

site implementation側のexplicit import mapへ解決するstable IDとする。

## ToolBindingRecord

```ts
interface ToolBindingRecord {
  contentId: string;
  moduleId: string;
  role: "primary_tool";
  status: "active" | "retired";
}
```

published Toolはexactly one active primary bindingを持つ。

Tool MDXはruntime componentをimportしない。

## Inline demo binding

Blog / Note等でinteractive demoを利用する場合、approved `Demo` content moduleから`moduleId`を参照する。

例:

```mdx
<Demo module="pid-response-playground" title="応答を試す" />
```

`Demo`自身はstatic wrapperであり、registryがinteractive child / hydrationを決める。

## Hydration policy

- `visible`: below-the-fold Tool / Demoのdefault候補
- `idle`: initial interactionが不要な軽量UI
- `load`: first-viewで直ちに操作が必要な場合のみ
- `media`: media query自体がhydration requirementの場合のみ

`client:only`をregistry標準modeにしない。

SSR不能なbrowser-only libraryが本当に必要な場合、個別architecture reviewを要求する。

## Framework policy

initial client frameworkはReactのみ。

別framework追加はregistry entryだけでは許可せず、frontend architecture ADRを要求する。

## Import map

implementation candidate:

```ts
const interactiveComponents = {
  "prime-factorizer": () => import("../interactive/PrimeFactorizer.tsx"),
} as const;
```

runtime user inputからarbitrary import pathを構築しない。

## Bundle isolation

interactive moduleのchunkは利用routeへ閉じ込める。

content-only routeへReact runtime / tool chunkを漏らさない。

CIで代表routeのclient JS manifestを検査する。

## AI authoring

Article Jobへはactive module registry snapshotだけを渡す。

AIは:

- 存在しないmodule IDを作らない
- hydration modeをMDX側でoverrideしない
- component import pathを生成しない

unknown interactive needはproposal / blockerとして出す。

## Versioning

breaking props / behavior changeは`apiVersion`を上げる。

content側がmodule-specific structured inputを持つ場合、そのschemaも`content-contracts`でversioningする。

## Validation

- Tool published -> exactly one active primary module
- module ID exists
- component ID exists in explicit import map
- allowed collection一致
- media hydrationならmedia query required
- retired moduleのnew reference禁止
- content-only routeへのunexpected module chunk禁止
