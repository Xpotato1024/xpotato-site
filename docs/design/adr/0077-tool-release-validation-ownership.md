---
status: proposed
owner: architecture
date: 2026-11-14
---

# ADR-0077: 製品検証はツールのリリース元、Site CIは取り込みと接続を検査する

## 背景

ツールの数値処理・境界入力・中止・deadline等をSite CIで毎回再実行すると、ツールの追加数と製品の試験規模に比例してサイト全体の待ち時間が増える。Primeの標準時間予算をCDPで観測する検査は、他のブラウザとの競合を避ける直列phaseも必要だった。本人の方針は、製品試験を配布元が持ち、検証済みの固定リリースをSiteが採用する責務分離である。

## 決定候補

- ツールのalgorithm、数値・入力境界、全engine、製品UI/copy状態、時間・資源・Worker同時実行のmatrixは配布元が所有する。Siteの通常CIへツールごとの製品試験を追加しない。
- リリース取り込み時にexact source/配布物と配布元の成功証拠を確認し、採用記録へ固定する。version/tag名だけを保証とみなさない。保証が不足していれば配布元側で補い、その版を採用してからSiteを更新する。
- Siteの既存installer/public admissionは全file bytes/hash、manifest、review、source、再現build、license、選択pinを引き続き検査する。毎回GitHubを照会したり配布元を再buildしたりしない。
- Siteが変え得る責務だけを実distで確認する。route/hydration、表示・CSP、wrapper unmount/navigation、license公開path、代表1操作、ホストのCSS/reflowが対象。Site生成のPWAはSiteが検査する。
- 全登録toolのmanifestに列挙された固定Worker文字列を、実routeから到達する最終bundle内の文字列とSHA-256で照合する。minifierがpayloadを変えるhost固有のriskを、数値計算の再実行ではなく静的なbytes検査で扱う。WASMを内包するWorkerも同じ完全bytesで検査する。
- 製品deadline検査を外したhost-only suiteは他のUI suiteと再び並行実行する。fresh profile/server、成功exit、report run identity、cleanup待機、build once、Windows consumer、production承認は維持する。

## 証拠と制限

現在のPrime v0.2.6の上流検証と削減対象は[CI測定記録](../../operations/ci-performance.md)を参照する。旧詳細検査 `prime-tool-interaction.mjs` は個別診断用に残すが通常release graphから呼ばない。古い診断結果を新しい版の保証として黙って使わない。

上流に自動Release発行gateがあるとは主張しない。現行版は公開Release、exact source CI、pin/review/配布bytesの対応を人がレビューして採用したもの。将来版もこの対応を確認する。本変更は公開デプロイ・上流タグ作成・新しい版の採用を認可しない。
