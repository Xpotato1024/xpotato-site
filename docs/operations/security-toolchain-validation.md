---
status: proposed
owner: operations
---

# セキュリティ更新後の再現検証候補

PR #111 は Node 24.22.1 と Sharp 0.35.5 の更新候補です。過去の acceptance record、凍結 tag、`legacy-freeze-baseline.json` は変更しません。本稿と toolchain binding はその採用候補であり、過去の承認を書き換えるものではありません。merge 前に operator がこの限定的な検証方式の変更を確認する必要があります。

## Legacy の観測と比較

[run 39653706925](https://github.com/Xpotato1024/xpotato-site/actions/runs/39653706925) の成功 artifact `12370865871` で、実測 Node 24.22.1 / npm 11.19.0 と、凍結 source の独立した2回の install / check / build 成功を確認しました。両 build の endpoint digest、非 HTML digest、90 files、既存の許容された HTML equivalence は凍結 baseline と一致しています。binding はこの成功 run の `reproduction-evidence.json`（SHA-256 `91007097dafd420cf4989f82c656a2189f98fa0cbaf9600c4fb47c82e2110011`）を出典とします。

`legacy-security-toolchain.json` はこの実測 evidence の identity と、変更していない凍結 baseline 全体の fingerprint を固定します。現在の `.node-version` と `packageManager` がこの観測と一致する場合にだけ、その版を runtime 比較に使います。source、lock、endpoint、非 HTML bytes、file count、許容 variance の比較は従来どおり毎回行います。次の runtime 更新や baseline 変更は silent admission せず、新しい実測 binding が必要です。

## Media の再生成

Phase 6 の既存 accepted review と101件の source identity は維持します。生成 JSON 候補だけを hosted CI artifact に保存し、Sharp 更新に伴う toolchain / variant manifest の差分を確認してから current manifest を更新します。過去の closure record にある hash は当時の観測として保持します。provider persistence、publication、deploy、承認済み bytes の置換は行いません。

## 補助 Lighthouse report

旧 `@lhci/cli@0.15.1` 配下の修正版がない `extract-zip` 等を除去するため、収集部分だけを公式 `lighthouse@13.5.0` / `chrome-launcher@1.2.2` の Node API に置き換えます。既存の3つの localhost route を各1回収集し、raw JSON と同じ summary field を残します。score gate、build、LHCI server、upload は追加しません。Chrome は専用一時 profile で起動し、成功・失敗時に終了と profile cleanup を行います。Lighthouse 自体の error reporting は無効です。12系と13系の測定値が同じ基準で比較できるとは主張しません。

`get-uri` 配下の `basic-ftp` は CVE-2026-102990 修正版6.2.1へ限定 override します。6系の別転送ホストを既定で許可しない変更は、この collector の localhost HTTP 入力では使用しません。互換性のローカル確認は通常の localhost EPSV 転送であり、PASV・FTPSや実計測の代用ではありません。実 Chrome での補助レポートは hosted CI で別に確認します。
