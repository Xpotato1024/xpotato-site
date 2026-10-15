---
status: proposed
owner: architecture
last_verified: 2026-10-15
---

# ADR-0049: 正式candidateから分離した手書きMarkdown下書き入口

採用済み2026-10-15記事設計A2の実装判断を記録する。過去のFreeze/acceptance manifestを変更せず、本ADRだけで正式candidate/provider運用を採用済みにしない。

本文作成をsource/evidence/画像の完成で妨げないため、private workingとArticle Job stateを分ける。human artifactにAI lineageを捏造せず、draft import/previewで正式DRAFTEDへ進めない。既存ArticleJobSpecとdisclosure policy bindingを使い、未指定permissionはfalseにする。

既存portable MDX AST検証をpackages/portable-contentへ移し、site validatorからの互換re-exportを維持する。previewはコードを評価しないHTML adapterを選び、画像/semantic runtimeをplaceholder/簡易表示とする。公開Astro layoutとの一致はA4のcandidate adapterへ残す。

immutable attempt snapshot、新attemptとsupersession、入力hashの毎コマンド照合により、旧ready/approvalを編集後の現在稿へ使わせない。stateの後戻りやterminal再開は追加しない。

専用private output、loopback/Host/Origin制限、default-deny CSP、通常buildとreleaseへの混入拒否を設ける。noindexをアクセス制御の代わりにしない。詳細は[非公開下書きpreview](../../operations/private-markdown-preview.md)。

後続はA3–A7の正式artifact/stage/audit/media/candidate/approval/persistence/export。本人承認や本番操作の境界は変更しない。
