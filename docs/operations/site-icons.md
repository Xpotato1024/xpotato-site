# サイトのアイコン

共通 `BaseLayout.astro` が全ページへ次のアイコンを宣言します。

- `favicon.svg`: 白背景と既存の紫色XPロゴ。Safari候補カードなどの背景にロゴの透明部分を委ねません。
- `favicon.ico`: 同じ図柄の16/32/48/64px。SVG非対応のブラウザ向けです。
- `icon-apple-touch.png`: 余白を含む180×180pxの不透明RGB PNG。`apple-touch-icon` で明示し、角丸はOSに任せます。

ロゴの形・色の正本は `apps/site/public/xpotato-logo.svg` です。アイコンを更新するときは `node tools/assets/generate-favicon.mjs` で再生成します。生成結果との一致、PNGの寸法・不透明性・白い余白、元ロゴのpath維持をtestで検査します。`validate:static` は全built HTMLのtouch icon宣言と配布PNGを検査します。

PNGは配布物検査の `siteIconPublicObjects` にpath・bytes・SHA-256を固定します。再生成でbytesが変わる場合は、この1件と対応testを同時に更新します。写真の必須集合や任意rasterの許可は広げません。

ホーム画面への追加のために、サービスワーカー、manifestの共通start_url、standalone指定は追加していません。ツールページを保存した際のURLを別ページへ変えません。`theme-color` はアイコンの背景を指定するものではないため、この修正では導入しません。

## iPhoneでの確認

配備後に対象ページをSafariで開き、共有メニューから新しくホーム画面に追加してロゴと遷移先を確認します。以前に追加したアイコンや候補カードはキャッシュが残る場合があります。既存アイコンが変化しないことだけを、現在の配布物の失敗の証拠とはしません。実機での更新時期やSafariが選ぶカード背景色はサイト側だけでは保証できません。

Safari 26ではUI全体でSVGアイコンに対応しましたが、以前のiOSを含む互換性のためPNGも提供します。実機確認とソース・生成画像・ローカルbuildの検査を区別します。

参考: [AppleのWeb Clipアイコン指定](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)、[WebKitのSafari 26 SVGアイコン対応](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#svg-icons)。
