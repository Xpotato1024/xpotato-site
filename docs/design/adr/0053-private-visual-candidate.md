---
status: proposed
owner: architecture
date: 2026-10-15
---

# ADR-0053: 決定的画像と共有Astroによる完全候補を私的工程に閉じる

A4として[画像・完全候補のローカル工程](../../operations/local-visual-candidate.md)を追加する。既存logo・OFLフォントのoutlineからhero/socialを再現し、実バイト・権利・独立画像監査を結んだ後にvariantsを作る。画像生成サービスは不要とする。

候補用Astro projectを.local内に作り、通常siteとContentLayout/CSS/静的moduleを共有する。通常content loaderと公開registryにprivate入力を差し込まない。通常buildで候補用環境変数を検出した場合は停止する。共有MediaPictureは登録済みの有限objectだけを表示する。

Serverの固定設計を参照してprovider-neutral planを作るが、実resource存在・権限・保存成功を主張しない。未確認計画とsynthetic scopeは参考previewに留め、正式candidate hashや本人承認権限を発行しない。承認・mock保存・exportはA5/A6へ残す。

画像・本文・監査・計画・render実装が変われば再検証し、旧approvalへ付け替えない。通常release buildの1回を維持し、専用private buildは明示して別に数える。旧44記事のholdと移行検証は維持する。

cleanup-safe compact media gateは共有APIとして単独検証する。実exportのGit recordsがまだない通常buildに空の権利/provenance全体を必須化せず、A6で対象記事への接続をレビューする。production CSP、workflow、storage、providerや資格情報の変更はこの単位に含めない。
