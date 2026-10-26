# 素因数分解機0.1.5の固定採用

既存ContentId bca48f98-c89a-457f-84d8-168f941fe469と /tools/prime-factorizer/ を保持し、承認済みGUI、Siteデザイン・SEO・共有・関連記事の変更を統合する。PR115／116は含めない。

対応ソースは 99133842d311d944d09f258bd29afd3d17ba9514、正式Releaseは https://github.com/Xpotato1024/browser-prime-toolkit/releases/tag/v0.1.5 。公開配布物を匿名取得し、全hashと対応ソースZIPを照合した。artifact SHA-256は a8791b00fb48847207a8e5e745729bab1ddf7ed68e5f3ec28eb67ea2d94d4fcb、manifest SHA-256は 2609ae235d1978c2d0aef7dc144b14eea03f77df0ef97c825e17f8c3f6859d2c、source tree SHA-256は 2093a46d9562e360fe3bbc7e00b9a48914f176eff0df1af40ce73e8d94943131。pin、capability manifestと説明metadata、LICENSE／NOTICE／source offer／第三者通知を同じ版へ固定する。旧0.1.4候補との配布差は版・manifest・source offerの4ファイルで、残り74ファイルの計算・Worker/WASM・CSS・依存・実行予算は同一。旧未公開候補のみexact-byte確認後に選択対象から外し、公開済み0.1.0〜0.1.2は保持する。

PR36の独立ソースreviewはP0/P1/P2=0/0/0。最終sourceの2clean buildは全78ファイル一致し、全671テストとcheck、byte-identical配布物のdesktopFirefox／WebKit各18ケースを確認した。初回Prefix Chrome startup timeoutとcollection-profile全体watchdogは、同じSHAの失敗jobのみ各1回再実行して成功。根本原因は未確定。v0.1.2 Native validation初回失敗／同source再実行成功・原因未確定、旧0.1.3／0.1.4 tag identity失敗、0.1.4 main GMP取得timeout履歴も保存する。

Site最終headの全体検査・実React合成画面と動作・独立review・CIを確認して通常マージし、成功main producerの固定Production artifactだけを既存GitHub手動workflowで一度配信する。PR artifactやlocal buildを昇格せず、provider前後確認は既存workflowを使う。資格情報・権限・CSP・監視設定は変更しない。

公開後に実ページの版、対応source、canonical／共有payload、主要asset bytesと入力・結果・設定・取消・コピー・通信制約を確認する。この準備文書は配信済みの証明ではなく、最終task／PR／deployment記録と公開readbackに結果を残す。実機iOS／Android、Safariアプリ、soft keyboard／autozoom、実BFCache、スクリーンリーダー、OS clipboard拒否画面、長時間・多Worker性能は未検証。desktopエミュレーションを実機保証へ拡張せず、Site全体の完成や無関係な記事公開・監視有効化とは区別する。
