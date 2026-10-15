---
status: proposed
owner: architecture
last_verified: 2026-10-15
canonical_for:
  - browser tool source and release adoption
---

# ブラウザツールの固定版取り込み

独立GitHub sourceの40桁commit、source tree、package-lock、配布manifest、配布ファイルのbytes/SHA-256、LICENSE/NOTICEを一組でreviewする。通常buildやruntimeはGitHub、CDN、latest tagへアクセスしない。実ツールの選定・外部repo作成・release公開・本番配信は別の判断であり、この基盤の試験成功から推定しない。

## 実装した契約

[共有schema](../../packages/content-contracts/src/browser-tool.ts)をJSON Schemaへ生成する。manifestはReact island API v1、memoryのみ、`none-after-ready`、明示した上限、SPDXと同梱license/notice、自己自身以外の配布file exact-setを持つ。初期capabilityのfile input/download/clipboard/Worker/WASMはすべてfalse。不明なfield/capability、remote/nonliteral import、React/ReactDOM以外のbare import、source map、未到達JS、未列挙CSSを拒否する。

release packageは`@xpotato-tool/<toolId>`、ESM default entryと`react/react-dom=19.2.8` peersのみ。追加runtime dependency・scripts・browser/imports overrideを持たない。CSSは`.bt-<toolId>`内の単純なselector/declarationに限定し、global reset、at-rule、url、escapeを拒否する。高度なCSSや新しいcapabilityは契約と受入条件の変更が必要。

JS ASTの禁止API検査はreviewの補助であり、任意の敵対的JavaScriptを封じ込めるsandboxではない。sourceとreleaseの意味上のreview、依存license/security確認、実際の操作試験が必要。初期CSPは通常の同origin asset取得を許すため、計算後の通信ゼロはCSPだけから主張しない。

## 明示的な取り込み

source checkoutはreviewしたcommitと一致するcleanな独立checkout。GitHub originもreview recordと照合する。source・lockfile・release生成コマンド・依存・licenseを先にreviewし、秘密のない作業場所で明示的に実行する。review recordには別のclean作業場所で実行した2回のartifact hashも記録し、両方が配布artifact hashと一致する必要がある。このrecordをpinのreview hashから辿れる形で同じPRへ保存する。取り込みCLIはsourceのbuild/installやclone/fetchを実行しない。

```sh
npm run browser-tools -- verify --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json
npm run browser-tools -- adopt --source /reviewed/source --artifact /reviewed/release --review /reviewed/review.json --vendor vendor/browser-tools --release reviewed-v1
npm run browser-tools -- select --vendor vendor/browser-tools --pins /reviewed/pins.json --tool tool-id --release reviewed-v1
```

vendor rootは事前に作成する。`adopt`は`<vendor>/<toolId>/<releaseId>/`へ検証済みバイト列をstage/renameし、pin JSONを標準出力へ返す。同一ID・異なるbytesを上書きしない。対象toolのlockで同時adoptionを拒否し、symlink/hardlink経由の入力を拒否する。信頼したローカルworkspaceを前提とし、別processが検証中のfileを敵対的に置換する環境の隔離はOS側で行う。

pinをreviewして`apps/site/src/content-registry/interactive/releases.ts`へ保存し、`apps/site/package.json`の明示的な`file:` dependency、root lockfile、static import wrapper、module registryの`releaseId`、Tools bindingを同一PRで変更する。CLIはその変更や公開を自動生成しない。新規active moduleはreleaseId必須、初期はToolsのprimary_tool/React/API v1のみ。既存素因数分解は従来のbuiltin identityを保つ。通常の最終検証は全pinのvendor bytesを再照合する。

更新は別releaseIdへ追加し、差し戻しは`select`で過去pinの現在bytesを検証してから既知のfile dependency/import/registryへ戻す。version/tagだけを信用しない。選択結果はJSONで返し、Gitへ反映する変更はreview対象。過去版の再downloadや自動更新は行わない。

## 合成fixtureによる接続試験

[fixture source](../../packages/site-validators/fixtures/synthetic-browser-tool/)は外部releaseではない。専用harnessがローカル一時Git repoを作り、2commit・固定Git blobから別々に作った作業場所で各版2回のclean出力一致・append-only adoption・更新選択・旧版の検証済み選択を試験する。fixture専用pinは公開registry/通常CLIで拒否する。

`npm run browser-tools:fixture`は通常production build後に実行する。副生成物は`.local/browser-tool-acceptance/`のみ。保存済み旧版を実際の`file:` dependencyと生成lockへ結び、install scripts無効・offlineの`npm ci`、明示的Astro React wrapper、共有module schema・Tool HTML検証・CSP生成を通す。2個のTool instanceは1個の試験用wrapper island内に置く。これは最小fixture hostのcomponent buildであり、production siteの再buildではない。

`release:interaction`でfresh Chrome profile、cache disabled、ServiceWorker bypass、fixture originのstorage消去から開始する。初回は同originの固定assetのみ。ready・font/paint完了後に通常/日本語/4096 bytes境界/4097 bytes超過/悪意ある文字列/resetをオンラインとオフラインで繰り返す。2instanceのID/state独立、text escaping、storage/URL/cookieに入力が残らないこと、純粋coreの50ms上限を確認する。CDP request/socket/navigation/popup/exception、CSP violation、unhandled rejection、HTTP server traceの両方を検査する。操作測定区間の後にtest-onlyの同origin Image requestを発生させてCDP/HTTP両方の検出を確認し、blocked fetchのCSP観測も確認する。

receiptは`XPOTATO_RELEASE_TEMP/browser-tool-ready-offline.json`。fixture markerが通常production distに含まれないことも検査する。通常siteの素因数分解・検索・記事移動等は既存のfinal-dist browser regressionを続ける。既存素因数分解の巨大入力に新しい応答時間保証や制限を付けない。

## 残る受入れ

実ツールは未選定。公開registryのrelease listは空であり、外部GitHub sourceのreview/依存install/再現build/release実績をこの合成試験で代用しない。実採用時には実際のcore/props/limits/licenseとsite package/import/bindingを固定し、そのツールのfinal distで同じ通信・offline・隔離試験を追加する。Firefox/WebKit/iOS実機と許可するfile/download等は別の受入れ。この段階はiframe/PWA/remote script/自動更新を提供しない。
