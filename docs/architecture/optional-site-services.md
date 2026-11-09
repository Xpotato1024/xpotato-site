---
status: proposed
owner: architecture
last_verified: 2026-11-09
---

# 問い合わせ・解析・コメントを任意機能として分離する

## 現在の実装候補と非稼働の境界

本人の「機能の追加はよいが依存の追加ではない」という意図に従い、静的本文・検索・ブラウザ内計算と、ネットワークを使う付加機能を分離する。[ADR-0071](../design/adr/0071-optional-site-services.md)の候補であり、merge・配信・外部設定・メール送信を行った記録ではない。

この差分に含むもの:

- 現状のメール/Issue連絡とブラウザ処理を説明する `/privacy/`。フッターと問い合わせから到達できる。
- `tools/engagement/contact-handler.ts` の単独受付コアと合成試験。public buildへのimport、公開API、deploy entry、メールadapter、provider bindingはない。
- publication generate/check時の `validateOptionalServicesAbsent`。未有効化のフォーム・コメント・既知の解析/Turnstile runtimeがHTMLや配布JSに混入した場合は失敗する。既知markerの検出であり、任意の難読化コードを安全と証明するものではない。既存CSP・tool runtime検査・PWA依存closure検査も継続する。

フォームUI、Web Analytics、コメントの稼働コードはまだ組み込まない。「未設定なのに送信できる」画面、偽の成功表示、実体のない送信先・保存日数・コメントサービス名を作らない。現状のプライバシー説明と公開物の無効状態を同じreviewで更新する。

## 動作の分離

- 公開本文は静的HTMLのまま。フォーム/コメント/解析の成功・ログイン・同意を本文表示の条件にしない。
- 全Tool routeにはこれらのruntimeを追加しない。Primeのdocumentの `connect-src 'none'` と `frame-src 'none'` を維持する。計算処理へのAPI clientやtelemetry callback注入も禁止。
- Primeのservice workerは公開アプリの固定ファイルだけを保存する。コメント・フォーム・解析・投稿内容・認証状態・送信待ちqueueをcache/IndexedDB/localStorageへ保存しない。オフライン時に送信を予約しない。
- 計算機のオフライン画面にコメント欄は不要。サービス障害・未設定・CSP拒否で計算やオフラインcold起動を壊さない。
- オンラインの対象記事でも、コメントは本文後の独立領域とし、失敗はその領域だけに閉じる。読み込みは明示操作から。遅い通信に永久loadingを出さず、内容とリンクを残す。
- analyticsは観測専用。取得完了をnavigation/render/計算のPromise chainへ入れない。共通BaseLayoutに無条件でbeaconを入れない。

## 問い合わせの有効化前に必要なもの

案は専用Cloudflare Workerで受付し、確認済み運営者メールへ送る。公開サイトWorkerへのbinding追加や動的化は行わない。資源・route・credentialの所有と変更は現行[infrastructure handoff](infrastructure-handoff.md)に従う。

1. 本人が確認した送信先、メール配送手段/処理事業者、保存・削除方針。現在表示しているメールアドレスを、providerのverified recipientとみなさない。
2. 問い合わせ内容・返信先・任意の名前、通信情報の処理目的と送信先、保存期間/削除の運用を明記した説明。メール、provider logs、rate-limit keyの扱いを分ける。
3. Turnstile Managed widgetのhostname/action固定と正式site key、server secret、受付URL。widget/credential/Worker/rate limitの実設定は別承認が必要。
4. rate-limit adapterの設定・trusted client key生成。Cloudflare Rate Limiting bindingは同一拠点単位で、世界全体の厳密な上限ではない。mail quota/費用を含む全体制限が必要なら別途設計する。
5. plaintextメールadapter。To/Fromはサーバー固定値で、入力emailを使う場合は検査済みReply-Toだけ。本文にHTMLを使わず、添付・自動返信は初期範囲外。送信結果が不明な場合に再送しない。
6. 専用の送信画面とroute限定CSP。フォームを開く操作までTurnstileを読まない。第三者処理の説明、通常のlabel、required/max length、送信中の二重送信防止、エラー後の入力保持、期限切れtoken再取得を用意する。オフラインでは送信せず、復帰時にも自動送信しない。
7. 実受信・spam/濫用・timeout・no-JS・CSP・keyboard・320px/200%・第三者blocked・既存Prime/PWA回帰を確認する。未実施の現在はフォーム提供完了/本番準備完了と呼ばない。

受付コアはPOST/Origin/JSON型、streamの24 KiB上限、各項目の長さ、header制御文字、余分なキー、honeypot、説明確認を検査する。頻度制限とSiteverifyの成功に加えhostname/action一致が必要。秘密鍵・token・本文・IPを応答やconsoleへ出さない。provider呼出しは合計8秒（構成上限15秒）で打ち切り、遅い成功から後続の送信へ進まない。

返却コード `accepted` は配送adapterの受付までで、受信箱到達の保証ではない。送信処理開始後の失敗/期限切れは `delivery_unknown`。画面は「受付結果を確認できません。重複を避けるため自動再送していません」と扱う。処理が外部で続いた可能性を失敗確定と表示しない。providerがidempotencyを提供するなら、別途同一送信への重複防止を実装・試験する。現在のコアには再試行queueや永続的idempotency保存はない。

## 解析と検索の区別

Cloudflare Web Analyticsは一般ページの閲覧・性能を把握する候補。Google Search ConsoleはGoogle検索での表示/クリック等の別指標で、検索順位改善の保証やサイト内行動の代替ではない。現時点でアカウント/property/token・実データを確認したとはしない。

採用前に取得項目・URL/referrer・第三者処理・保存/同意要件を確認する。少なくとも `/tools/`、`/search/`、`/contact/`、preview/noindex、query/hashを持つページは計測対象から外す案とする。tool入力・検索語・問い合わせ文をeventへ載せない。automatic injectionによる全ページbeacon追加はこの境界に合わない。CSPと明示対象routeのruntime予算を変更する別差分で導入する。

## コメントの未決事項

対象は明示した少数の記事、一般読者のアカウント必須でない方式、公開前の運営者承認を候補とする。サービスは未選定。本文のContentIdを安定したthread keyとし、URL変更だけで別threadを生まない設計とする。

保存先/保存期間/削除申出、モデレーション負担、公開される名前と本文、メールが必要か、投稿者への案内、spam/頻度制限、停止/移行/エクスポートを確認する。匿名可でもspam対策不要とはしない。デフォルト全ページ表示、Tool/PWAへの組込み、自動公開は採用しない。

## 公式資料（2026-11-09に読取り）

- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): server検証必須、tokenは5分・一回限り。失効/重複時は新しいtokenが必要。
- [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/): bindingの制限は同一Cloudflare location単位。
- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/): beaconによるRUM。仕様説明はアカウントでの有効化や実測の証拠ではない。

どのproviderもこのPRで設定・契約・送信・有効化しない。検索/解析の実データ、実受信、公開コメントは未検証。
