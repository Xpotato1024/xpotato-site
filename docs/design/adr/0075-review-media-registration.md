---
status: proposed
owner: architecture
date: 2026-11-13
---

# ADR-0075: レビュー用の画像登録を記事の採用から分離する

## 問題と範囲

記事の表示レビューには公開配信用画像が必要だが、ADR-0063の保存とexportを一体にした経路では、画像の変更ごとに記事別admissionをmainへ採用する必要がある。媒体登録を記事の採用から分け、画像を登録・差し替えてから記事PRを確認できるようにする。

「レビュー前」は記事PR・サイト表示の最終レビュー前を指す。画像の権利、公開配信の許可、privacy、実bytes、既存の内容・画像確認を省略する意味ではない。これは追加実装候補であり、mainへの採用・実保存・記事配備を自動で認可しない。

## 最小の変更

既存の検証済みpublication packageをそのまま使う。新しいpayload、署名broker、TTY、承認画面は作らない。通常producerまたはADR-0074の専用producerの証拠を保ち、AI PASSや本人receiptを補作しない。

保護された手動workflowに `register-media` / `verify-media-only` を追加する。ownerがmainの実行code SHA、draft release asset ID、完全package SHAを選択する既存操作を、画像登録だけの認可境界とする。downloadしたpackageやadmissionのフィールド自体を認可authorityにはしない。登録modeに限り、記事の存在、記事別main admission、記事preimage、公開日投影、記事exportを要求しない。

main固定実行コード、owner/triggering-owner、manual、attempt 1、site-production Environment、有効化Variable、既存A/B/C限定SDK設定と権限は維持する。取得時はR2 secretsを渡さず、保存stepでも実HEAD・選択hash・package全体・画像bytesを再検証する。package中のJS/MDX/build/install scriptは実行しない。

## 結果と後段の境界

登録はA原本、B公開配信、B実bytesからのC保護コピーを保存し、A/B/Cと公開HTTPSの完全readback後にmedia専用receiptを出す。receiptはpackage/semantic/registry/rights/object集合・設定hash・実行context・観測時刻とreview URLを束縛する。MDX、draft、pubDate、index、公開provenance、記事patchを生成・変更せず、`articleDeployed=false` / `exportAuthorized=false` を明示する。

差し替えは新しいhash keyへ保存する。旧objectの上書き・削除はしない。同一bytesはGET一致で再利用する。不明PUTは自動再送せず停止し、新しい手動 `verify-media-only` でGETだけを行う。

最終記事exportは既存 `publish` / `verify-only` を使い、選択した最終packageとmain admission、記事preimage、全媒体の再readbackを要求する。media専用receiptはmain admissionや記事承認の代わりにならない。同じ媒体なら既存objectを再利用する。最終版と違う画像の古いreceiptを流用してexportする入口は追加しない。

記事競合は後段exportを停止するが、画像の確認・差し替えを妨げない。実行コードのmain採用は一度必要だが、媒体だけの各変更についてadmissionのPR/mergeを繰り返す必要はない。

## 検証

合成packageとmock storageで、記事未存在/admissionなしの登録、旧bytes不変の差し替え、GET-only再利用、記事競合時の登録成功と後段export拒否、不明PUT/読戻し不一致、権利・集合・privacy・画像検証、mode混同と非owner/non-main/attempt 2拒否を確認する。CLIはsecrets前後のhash・HEAD確認と成果物の分離を検査する。実R2操作やphase-gateの受入れとは区別する。
