---
status: proposed
owner: operations
last_verified: 2026-11-07
---

# Primeのオフライン利用と更新

この手順はADR-0070の実装候補に対応する。Draft PRの成功は本番適用・iOS/Android実機受入れではない。

## 利用開始

1. オンラインで `/tools/prime-factorizer/` を開く。
2. 「ホーム画面・オフラインで使う」を開き「オフライン用に保存・更新」を押す。保存完了を待つ。
3. 必要ならブラウザのメニューでホーム画面へ追加する。ホーム画面アプリの保存領域が異なる場合は、そちらをオンラインで開いて再度保存する。
4. ツールのタブ/アプリを閉じ、通信を切って開き直し、表示と計算を確認する。

名前・アイコンが古い既存ショートカットはOSがmetadataを保持する場合がある。確認してから利用者が削除・再追加する。追加を強制するpromptや機種固有の自動操作は実装しない。

保存するのは公開アプリファイルのみ。数値・結果・計算途中・設定は保存しない。検索・記事・外部source/licenseリンクはオンライン利用。初期表示に必要なファイルはまとめて保存するが、計算の速度や大型WASM割当の成功は端末に依存する。

## 更新

- オンラインで「保存・更新」を押すと更新を確認する。導入後はブラウザが自動で更新確認・ファイル取得する場合もある。
- 更新が待機中でも現在の計算を再読込しない。計算終了後、同ツールのすべてのタブとホーム画面アプリを閉じ、開き直す。
- オフラインのままでは新しい版やrollbackは届かない。オンラインでの取得後も旧画面が残っている間は切り替わらない。

## 保存が消えた場合

保存完了は永久保持を意味しない。容量不足、OS/ブラウザの整理、サイトデータ削除などで失われる。

保存不足が表示されたらオンラインで「保存・更新」を押す。不完全な保存は登録を解除し、その画面の保存ボタンを無効にする。解除の案内が出たらツールのタブ/アプリをすべて閉じ、オンラインで開き直して保存する。欠損cacheによる503画面で解除の案内が出た場合も同じ手順を使う。回復できない場合は利用者がブラウザ設定から当該サイトのデータを削除する。これはサイト内の他の保存にも影響するので、アプリから勝手に実行しない。

## 配備・rollback・撤去

通常のowner/main/manual deployment認可・exact artifact検証・read-backを維持する。PWA導入はprovider設定変更、merge、deployの認可を含まない。manifestとsw.jsもpublication targetに含め、scriptはno-cache、manifestは正しいMIMEで配信する。

旧PWA版へのrollbackでは同じscope/script URLを保ち、旧artifactのclosureを一括取得する。PWA以前のartifactだけを再配備しても端末のSW/cacheは残る。撤去する場合は新しいreview済みartifactで同じsw.js URLの廃止workerを供給する。計算中の強制reload/claimをせず、online再訪と全ツール画面終了後に自然activateして、Prime専用cacheの削除と自身のunregisterを行う設計を別途検証する。撤去workerの実装・配備は今回実行していない。

本番確認ではHTTPS、Content-Type、CSPの重複/結合、Service-Worker-Allowedがscopeを広げていないこと、Cache-Control、offline cold launchを確認する。iOS Safari/ホーム画面、Android Chrome/インストール、保存拒否と実際の容量消去、複数タブを実機で確認するまで、その実機保証を主張しない。
