---
status: accepted
date: 2026-09-24
owner: architecture
---

# ADR-0032: vNext production deploy artifactを決定的にする

## Status / authority

**Accepted — operator acceptance 2026-09-24。** Exact reviewed/audited implementation candidate `7686abd360c46775c4e9fbef7e3209af8ba43c63` のdesign/implementation semanticsを採用する。Acceptance recordは `../amendment-acceptance-adr-0032-2026-09-24.md`。本acceptanceとmain mergeはCloudflare mutation、JIT token発行、production deployを認可しない。2026-09-24の最初のdeploy attemptはartifact identity不一致でABORTED_BEFORE_DEPLOYとなり、その認可は終了した。

ADR-0030はAstro 5.18.1 / React integration 4.4.2のfrozen legacy reproduction comparatorだけを扱う。本ADRはAstro 7.2.7 / @astrojs/react 6.0.4 / React 19.2.8のvNext最終deploy bytesを扱い、legacy comparatorやfrozen outputへ変更を加えない。

## 発端と観測

承認済みmanifest aggregate 6a41d607df46722aeae580e195d29aed46d5a5944cfe1de25b18f51034542b4eとfresh build aggregate bfef8683619dcf2e1d7e4c24d537e90ebe222f2516fb28e678ee6b7f40e481b5は不一致。32ファイルの集合は同じで、31ファイルのsize/SHA256が一致した。唯一のファイル差はtools/prime-factorizer/index.htmlのastro-island uid値。加えて旧manifestとfresh manifestはfiles配列の順序が異なり、旧aggregateはJSON.stringify(files)の順序に依存していた。UIDだけ戻しても配列順が異なる限りaggregateは一致しない。

同じSite exact base 164bdaeeb1b9492bb7ce5343c8b1765844016b91を、task temp内のpath-a/siteとdifferent/path-b/siteで、同じNode 24.19.0、npm 11.19.0、lockfileからclean install/buildした。task-localのinstalled Astro shorthash直前にtraceだけを挿入し、repository sourceとdistの内容はinstrumentationで変更しなかった。各buildの該当hash inputは1件。先頭行はそれぞれ異なる絶対checkout pathで終わる/apps/site/src/components/islands/PrimeFactorizer.jsを含む。以降のSSR HTMLとserialized propsのsuffixはbyte-identical（SHA256 ebd262ae89eab42c11ab583817c53e7be2d9a8d5200fe8b778f36bf26c820ca9）。raw UIDはZ1BMTyKとZ1AHQX7、raw distは32件中Tool HTMLだけが異なった。**直接のcausal fieldはmetadata.componentUrl内の絶対checkout path**である。

## Version-pinned runtime証拠

npm ciしたexact dependency sourceで確認した。

| source | 判定 |
| --- | --- |
| astro@7.2.7/dist/runtime/server/render/component.js:272-278 | componentExport.value、metadata.componentUrl、SSR HTML、serialized propsをshorthashへ渡す |
| astro@7.2.7/dist/runtime/server/hydration.js:77-112 | 得たIDをuid属性に載せる。source commentはHMR用途と記す |
| astro@7.2.7/dist/runtime/server/astro-island.js | browser custom elementの属性観測、schedule、module load、props/slots、hydrate/unmountにuid参照がない |
| @astrojs/react@6.0.4/dist/client.js | React hydratorはelement、SSR、props/slots、prefix等を使い、uidを読まない |

上記4ファイルのSHA256は順に88cd90641fe8e7ba12afe91f31b5ef95eb70048459ed85ef8010f47d53cf653a、86824502280c55496eda9ae9929307c1f51e527f4b9f7e63f1d1fc5216a9793d、01097c0fb7754fad01b4f298f98e1d6d2776fabc08d9987e6b492a4325f895e1、a6723c674206ab2aafea5cd5d42b4791bdd196bad5a18e5091b624bf5a5cbaf6。このexact profileでの判定は**NON_RUNTIME_GENERATED_METADATA**。将来versionには継承しない。

## 提案するproduction artifact contract

同じexact source/lock/toolchain、異なる絶対checkout path、supported Windows/Linux buildから、**canonicalization後の最終dist全ファイルがbyte-identical**になり、同じoutputTreeSha256を持つこと。raw Astro outputは比較・debug evidenceとして保持するが、deploy approval identityではない。canonicalizerはraw UID差を無視する比較器ではなく、実際にWranglerへ渡す最終HTMLのUID値だけを決定的に書き換える。

Pipeline:

    Astro raw production build
      -> vNext bounded UID canonicalization
      -> security check
      -> SearchDocument extraction / MiniSearch index
      -> final static validation
      -> canonical deploy manifest / tree SHA256
      -> exact deploy artifact (dist)

root npm run buildが全stageを順序付きで実行する。手動deploy時だけのoptional処理にしない。legacy reproduction pipeline、migration comparator、frozen legacy artifactには触れない。

### Initial positive-proof profile

初期対象はroute /tools/prime-factorizer/、file tools/prime-factorizer/index.html、DOM順ordinal 0の唯一のastro-island。他HTMLのisland、追加・欠落・位置変更はFAIL。Interactive Registryのactive prime-factorizerからprime-factorizer-react-v1 / React / visible / tools限定、Tool content binding、PrimeFactorizerVisible.astroのclient:visible、component import mappingを確認する。

parsed DOMとsource locationで、uid以外の全属性、順序、quote/spacingをexact profile opening tagと照合する。component URLは/_astro/PrimeFactorizer.B0vyJ8Ra.js、renderer URLは/_astro/client.XHtoj3W1.jsで、各asset SHA256も固定。component-export=default、props={}、ssr、client=visible、prefix=r1、opts、await-children、SSR children SHA256、UIDだけを{UID}に置換したpage SHA256を確認する。unknown属性、asset差、SSR差、周辺HTML差はFAIL。初期profileはAstro 7.2.7、integration 6.0.4、React/React DOM 19.2.8に限定し、declared / lock / installedの不一致はUNREVIEWED_RUNTIME_VERSION。合法的な将来変更も新しいprofile reviewが必要であり、暗黙に範囲を広げない。

### UID値とrewrite

UIDはUTF-8の固定順序tuple [profileId, route, ordinal, componentUrl, componentExport, rendererUrl, client, props, sha256(raw SSR children)]をJSON.stringifyし、domain xpotato-vnext-uid-v1のNUL byteを前置したSHA256全64桁hexからxpv1-<hex>を作る。tuple、key/array順、UTF-8、domain、hex長を固定する。raw UID、絶対path、locale、時刻、乱数は入力にしない。初期profileは1 islandのみを許すため衝突候補・unknown islandはFAIL。

parse5は位置と構造の検証のみ。actual rewriteは元UTF-8 bufferの証明済みuid値byte rangeだけを置換し、置換後に旧値を戻せばraw bufferとexact一致することをassertする。HTML全体の再serializationは禁止。曖昧なrangeはFAIL。

### Manifest / tree digest

dist-relative / path、NFC、空segment・.・..・symlinkなしを要求する。entryをUTF-8 bytewise Buffer.compareで明示sortし、localeCompareやfilesystem enumeration orderを使わない。各entryはrelativePath、byteSize、lowercase SHA256。tree SHA256のinputはASCII domain xpotato-site-deploy-tree-v1とNUL byte、4-byte big-endian file count、各entryの4-byte big-endian UTF-8 path byte length + path bytes + 8-byte big-endian size + 32 raw SHA256 bytes。長さを付けたframingで曖昧さをなくす。manifest JSONは固定key順・2-space・LFでsidecar出力でき、generatedAt等の観測時刻をdeterministic identityに入れない。sidecarはdist treeへ含めず、outputTreeSha256はWrangler assets.directoryが指す最終distの全ファイルを対象にする。

raw Astro tree SHA、canonicalization直後/search前tree SHA、最終tree SHAと、元/最終HTML SHA、UID値、byte-range proofを区別して記録する。raw treeを最終deploy artifactと呼ばない。

## 代替案

| 案 | 評価 |
| --- | --- |
| UIDをdeploy authorization比較時に無視 | **Reject**。承認byteと実deploy byteが異なるexact gate弱化 |
| operationごとにrandom UID aggregateを再承認 | 安全だがcheckout pathでidentityが変わり続け、運用が不安定 |
| 全buildを固定絶対pathに強制 | Windows/Linux、GitHub Actions、将来の実行場所に脆弱 |
| version-pinned bounded post-build canonicalization | **Preferred**。runtime非消費の証拠、positive proof、byte-only rewrite、cross-platform実測を前提 |

## Candidate acceptance / stop

同一path反復、異なる絶対path、enumeration shuffle、UID-only fixtureの収束、non-UID/asset/version/unknown islandのFAIL、Windowsとhosted Linuxの32/32 size/SHA256とtree SHA一致を要求する。Windows generated JSONの既知CRLF freshness divergenceおよびPhase 6 media processingのWindows論理差は別件であり、本件PASSへ読み替えない。ADR-0032は2026-09-24にoperator Accepted。main mergeは本design/implementationを採用するが、別途production deploy authorizationなしにCloudflare mutation・token発行・deployへ進まない。
