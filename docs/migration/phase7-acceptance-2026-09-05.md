---
status: proposed
owner: migration
last_verified: 2026-09-05
canonical_for:
  - Phase 7 Interactive Tool closure candidate
  - Phase 8 route and discovery handoff after merge
---

# Phase 7 Interactive Tool Closure Candidate — 2026-09-05

## Decision

Phase 7のrepository implementationは、frozen legacyに対するPrimeFactorizerのmaterial interactive parity、Interactive Module Registry integrity、route-local runtime、`client:visible` hydration、bundle observationを満たし、**READY FOR REVIEW**である。

```text
Phase 7 implementation candidate: READY FOR REVIEW
fresh read-only audit: PASS — P0=0 / P1=0 / P2=0
additional operator acceptance: NOT REQUIRED
normal PR review/merge: REQUIRED
Phase 8 implementation: NOT STARTED
provider/deploy/cutover mutation: NOT AUTHORIZED / NOT RUN
```

本記録はPR merge前のclosure candidateである。Normal PR pathでmainへmergeされるまでPhase 7を`CLOSED / MERGED`とは扱わず、Phase 8をactive implementation gateへ進めない。

## Exact authority and implementation target

```text
base main: 45403b2a3a91e10bebf0c80d72e88efbdf58fa9c
implementation candidate: 9e400865c06b81ae586d98a93c676d31dfd1150f
legacy tag: legacy-pre-vnext-2026-08-28
legacy tag object: 8503f5a50a5fb3d27a02422da0b50dc66c818b02
legacy peeled commit: 927d105713561309fc5e2374396f86646b5aeb2a
legacy component blob: 04b3b440c3fe5f05c5ad93fc4646502318f92944
legacy content blob: da655971601bbf09dafe8d2bbc4cfdcb511d1d78
Phase 7 evidence payload: 80f042ebb5212ba678a005eb9f0dc5ec53a52899b035b4efb658d42eb11aefd9b
```

Legacy authorityはimmutable tag/commitのGit objectであり、mutable `src/` working treeではない。Exact legacy source byte SHA-256、generated HTML observation、island/component assets、accepted non-HTML manifest SHA-256は`phase7-interactive-readiness-v1.json`に記録する。ADR-0030のgenerated `uid` varianceは既存の限定されたbuild-equivalence問題として保持し、Phase 7 product semanticsへ拡張しない。

## Identity retained

既存foundationのidentityは変更していない。

```text
Tool ContentId: bca48f98-c89a-457f-84d8-168f941fe469
module id: prime-factorizer
component id: prime-factorizer-react-v1
framework: react
hydration: visible
role: primary_tool
allowedCollections: tools only
module/binding status: active
budgetClass: small
```

## Observable parity

Frozen legacy source/buildから次をmaterial parityとして抽出し、machine-readable evidenceとtestsで固定した。

- initial draftとlast accepted valueはともに`360`で、initial resultは`360 = 2 × 2 × 2 × 3 × 3 × 5`;
- inputは`type=number`、`inputMode=numeric`、`min=2`、`step=1`で、`required`ではない;
- draft changeではaccepted value/resultを変更せず、form submitだけがcommit trigger;
- `Number.isInteger(Number(draft)) && Number(draft) > 1`だけをacceptし、invalid submitはprevious accepted value/resultを保持;
- prime/composite/repeated factorをascending orderかつmultiplicity込みで`value = factor × ...`として表示;
- frozen legacyには`Number.isSafeInteger` restrictionがなく、ECMAScript `Number`のunsafe integer roundingも同じまま保持;
- Enterと`分解する` buttonはいずれもsemantic form submitを使用する。

Current vNextに存在したinitial `84`、changeごとの即時factorization、submit button欠落、factor列だけのoutput、safe-integer restriction、異なるinvalid wordingはmaterial mismatchとして除去した。Tailwind class、色、border、spacing、card/heading presentation、説明文はpresentation差分としてparity対象外のままにした。

Accessibilityはexplicit label、semantic form、native keyboard submit/focus、submit button、`aria-live=polite`かつatomicなresult announcementを維持・改善した。Clickable `div`は導入していない。これらはfactorization/state semanticsを変更しない。

## Registry and hydration integrity

既存contractを再利用し、第二schemaを作らず次をfail-closedで検証する。

- published Tool ContentIdはexactly one active primary bindingを持ち、Tool bodyはそのmoduleをexactly once参照する;
- module、component import、selected hydration rendererが存在する;
- non-`media` hydrationは`mediaQuery`を持てず、`media` hydrationは`mediaQuery`必須;
- moduleは`tools`だけで使用可能;
- unknown/retired module、retired-only binding、unauthorized collection、missing rendererはfailure;
- portable content sourceはdirect runtime component/hydration pathを持たない。

Registryは`visible`、selected rendererは`<PrimeFactorizer client:visible />`で一致する。Built routeは`client="visible"`とSSR shellを持ち、`client:load`/`client:only`への退行はない。

## Route-local runtime and bundle observation

Exact implementation buildの`/tools/prime-factorizer/`はAstro island 1件を持つ。Recursive emitted client asset graphは次のとおり。

| Asset | Raw | gzip | Role |
|---|---:|---:|---|
| `/_astro/PrimeFactorizer.B0vyJ8Ra.js` | 1,506 B | 874 B | PrimeFactorizer-specific component |
| `/_astro/client.XHtoj3W1.js` | 184,065 B | 57,328 B | Astro React client renderer / React DOM runtime |
| `/_astro/react.OrosJ8bI.js` | 8,058 B | 3,109 B | shared React support chunk |
| external graph total | 193,629 B | 61,311 B | per-asset Node zlib default gzip sum |

Tool HTMLのexecutable inline scriptは4,752 Bである。`/`、Blog archive、Notes detail/archive、Projects detail、static PageはAstro island 0、executable inline script 0 B、client JS asset 0件であり、site-wide React bundleはない。

Ordinary Blog detailは既存publication holdによりmigrated 44件と追加fixture 1件がすべてdraftで、build対象routeが存在しない。このためbuilt HTML measurementを成功扱いせず`not-built-publication-held`として記録した。全45 sourceがdraftで、active interactive referenceは0、Blog detail rendererにdirect client runtime referenceはない。Publication gateでBlog detailがbuild対象になった時点でactual emitted graphを再測定する。

`budgetClass=small`は保持するが、hard byte thresholdはOpen Decisionのままである。Measured bytesだけを記録し、arbitrary KiB thresholdは追加していない。Threshold calibrationはPhase 12/O7へhandoffする。

## Validation and audit evidence

Exact Node `24.19.0` / npm `11.19.0`で次を確認した。

```text
npm ci: PASS
npm run phase7:check: PASS
  Phase 7 focused tests: 4 files / 38 tests PASS
  Astro check: 0 errors / 0 warnings / 0 hints
  static build: 17 pages PASS
  registry/repository/static/security checks: PASS
  behavior cases: 12
  built content-only route classes: 6
git diff --check: PASS
```

Playwright等のbrowser dependencyは追加していない。Pure state transition/factorization tests、React SSR shell test、built HTML/island/asset graph validation、native semantic form submit contractの組合せで、button/Enter submit、invalid state retention、hydration shellを決定的に検証できるためである。

Windowsでのroot `npm run ci`は、Phase 7へ到達する前の既存Phase 6 Sharp生成PNGがcommitted Linux evidenceとbyte非同一になるため`migration:media:processing:check`で停止した。Phase 7専用gateは同じWindows exact toolchainでPASSしている。Normal merge gateではexact headのGitHub-hosted Linux `vNext CI`と`Phase 7 interactive readiness`の成功を必須とし、hosted full CIが失敗した場合は本candidateをcloseしない。

Implementation candidate `9e400865c06b81ae586d98a93c676d31dfd1150f`へのfresh read-only auditは次の重点を再確認し、**PASS — P0=0 / P1=0 / P2=0**である。

- exact frozen tag/commit/blob authority;
- parity boundaryがvisual differenceを使ってmaterial behaviorを除外していないこと;
- invalid draftとlast accepted resultの分離;
- Registry SoTとhydration directiveの一致;
- built client asset graphによるroute-local isolation;
- accessibility regressionなし;
- performance thresholdを捏造していないこと;
- Phase 8/provider/deploy/cutover scope creepなし;
- `persistentMutationAuthorized=false`とdeploy workflow hard blockの維持。

## Safety boundary

`persistentMutationAuthorized: false`を維持し、`.github/workflows/deploy-site.yml`のjob-level `if: ${{ false }}`を変更していない。Cloudflare/R2/DNS mutation、Wrangler deploy、production cutover、legacy deletion、redirect implementation、search/discovery parity拡張はすべて**NOT RUN**である。

## Acceptance and Phase 8 handoff

新しいmaterial product behavior decisionは行っていない。Frozen legacy semanticsの復元と既存accessibility policy内の改善なので、追加operator acceptanceは不要であり、normal PR review/mergeだけが必要である。

Merge後のPhase 8 handoffはroute/SEO/discovery/search parityに限定する。`legacyUrls`はevidenceとして参照できるが、このPhase 7 candidateは`/blog/prime-factorizer/`、`/blog/category/tools/`、`/?p=34`その他のredirectを実装しない。Blog detailがpublishableになった時点のactual runtime-isolation再測定と、Phase 12/O7のbundle class threshold calibrationをnon-blocking handoffとして残す。
