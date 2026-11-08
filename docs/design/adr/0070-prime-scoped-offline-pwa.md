---
status: proposed
owner: architecture
last_verified: 2026-11-07
---

# ADR-0070: 素因数分解機だけをホーム画面・オフライン起動に対応する

## 位置付け

アイコン整備に続きPWAまで進める本人依頼に対する実装候補。Draft PRの変更であり、merge・production配信・実機受入れは別。既存固定版toolのmanifest、source pin、計算・Worker/WASM・入力非送信・設定非永続化は変更しない。

## 決定

- サイト側が `/tools/prime-factorizer/` 専用manifestとService Workerを持つ。id/start_url/scopeは同じ固定route、displayはstandalone。ホームや記事・検索にはmanifest/登録コードを付けない。
- 既存XPの白地アイコンから192/512px PNGを決定的に生成し、配信検査は各path/size/hashだけを許可する。maskableとは表示しない。
- 初回保存は利用者の「オフライン用に保存・更新」操作。ホーム画面への追加はOS/ブラウザの通常操作。導入後はブラウザがページ起動時などにSWの更新を確認し、新版のアプリファイルをバックグラウンド取得する場合がある。
- 保存対象は最終distのPrime HTML、専用manifest、実際のJS依存closure、CSS/font、共有ロゴ・共有操作アイコン。全サイトや外部media、検索index、入力・結果・設定・cookie・URL query・API responseは保存しない。最大128files/12MiB。
- インストールは毎fileのHTTP成功、redirectなし、同origin、size/SHA256/CSP一致を検査。配信途中の混在や容量不足では当該installが新規作成した候補cacheだけを破棄する。同版の既存cacheが完全なら内容を再検証して再利用し、不完全な既存cacheの補充失敗でも既存cacheは削除しない。これによりA使用中/B待機中のAへのrollbackでも稼働中Aを壊さない。キャッシュはrelease全体の内容から命名する。runtimeのfetch responseは追加保存しない。
- documentはconnect-src noneを維持。登録用にPrimeだけworker-srcへselfを追加。SWの正確なscript pathだけ別CSPでconnect-src selfを許し、他toolやページのCSPを広げない。SW自体も生成した固定allowlist以外をprefetchしない。
- 更新時にskipWaiting/clients.claim/自動reloadを使わない。旧versionの全controlled documentを閉じた後の通常activationで切り替える。過去の登録が残したPrime画面がある場合も旧cacheを消さない。旧cacheの掃除はactivation時に生存Prime画面がない場合に限る。
- 保存完了表示はregistrationの存在だけで判断しない。選択workerに固定closureのcache key/responseが揃っていることを照会する。保存消去時は成功と表示しない。保存操作で不完全なcacheを検出したら登録を解除し、その画面で再登録せず全タブ/アプリの終了を要求する。通常起動で要求されないiconだけが消えた場合もこの手順で復旧できる。
- キャッシュ欠損時は別versionのネットワークassetを混ぜず503で止め、登録を解除する。利用者に全タブ/アプリを閉じてオンラインで開き直す案内を出す。

## 範囲と制約

最初からオフラインの端末、保存消去後、private browsingや保存拒否環境、OSが停止した計算の再開は対応保証しない。インストール可能性と保持期間はブラウザに依存する。Safariとホーム画面アプリの保存領域が異なる場合はホーム画面側でオンライン保存が必要。標準のブラウザキャッシュは永続性を保証せず、persistent storage権限は要求しない。

計算器自身のready後通信ゼロは維持する。PWAを有効にしたページ全体では、利用者の保存操作・ブラウザのSW更新取得が別に存在するため「全通信ゼロ」とは表現しない。初期取得後の通常計算試験は既存gateを残し、PWA cold-start/更新試験を追加する。

## 検証と復旧

最終配信artifactで初回保存、改竄/不完全asset、ブラウザ本体終了・再起動後のオフライン起動と計算、計算中のwaiting更新、全タブ終了後の切替、旧版へのrollback、保存消去、icon単体消失からの復旧、他route非制御を検査する。Unitではquota/CSP不一致/namespace cleanup/同版cacheの所有権も検査する。ChromiumのPC検証をiPhone/Android実機のホーム画面受入れとは扱わない。

運用手順は[Primeのオフライン利用と更新](../../operations/prime-offline-pwa.md)。既存immutable artifactのrollbackも通常のSW更新と同様に次回オンライン取得・全タブ終了が必要。PWA以前のartifactへ戻すだけでは登録済みSWを消せないため、緊急撤去は同じscript URLに専用の廃止workerを含む新しいreview済みartifactを作り、別のproduction認可を得る。SWファイル削除だけで撤去完了としない。
