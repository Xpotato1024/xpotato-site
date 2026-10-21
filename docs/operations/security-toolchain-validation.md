---
status: proposed
owner: operations
---

# セキュリティ更新後の再現検証候補

PR #111 は Node 24.22.1 と Sharp 0.35.5 の更新候補です。過去の acceptance record、凍結 tag、`legacy-freeze-baseline.json` は変更しません。本稿と toolchain binding はその採用候補であり、過去の承認を書き換えるものではありません。merge 前に operator がこの限定的な検証方式の変更を確認する必要があります。

## Legacy の観測と比較

[run 39643616911](https://github.com/Xpotato1024/xpotato-site/actions/runs/39643616911) の artifact `12367180289` で、Node 24.22.1 / npm 11.19.0 による凍結 source の独立した2回の install / check / build は全て成功しました。両 build とも endpoint digest、非 HTML digest、90 files、既存の許容された HTML equivalence が凍結 baseline と一致し、失敗理由は旧 Node 24.19.0 との版比較だけでした。

`legacy-security-toolchain.json` はこの実測 evidence の identity と、変更していない凍結 baseline 全体の fingerprint を固定します。現在の `.node-version` と `packageManager` がこの観測と一致する場合にだけ、その版を runtime 比較に使います。source、lock、endpoint、非 HTML bytes、file count、許容 variance の比較は従来どおり毎回行います。次の runtime 更新や baseline 変更は silent admission せず、新しい実測 binding が必要です。

## Media の再生成

Phase 6 の既存 accepted review と101件の source identity は維持します。生成 JSON 候補だけを hosted CI artifact に保存し、Sharp 更新に伴う toolchain / variant manifest の差分を確認してから current manifest を更新します。過去の closure record にある hash は当時の観測として保持します。provider persistence、publication、deploy、承認済み bytes の置換は行いません。
