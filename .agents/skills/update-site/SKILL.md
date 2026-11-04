---
name: update-site
description: xpotato-siteの既存記事、ツール、固定ページ、サイトスタイルを更新するときに、正本と変更範囲を選び既存CLIで検証する。新しい公開権限やprovider設定を与えない。
---

# サイトを更新する

[編集経路](../../../docs/operations/content-workflows.md)から最も狭い入口を選ぶ。まず対象ファイル・現在のID/URL・既存変更と公開状態を確認する。

- 記事: private Jobを`article init --content-id <UUID> --update-kind correction`で開始し、元本文/Registryを固定する。修正対象の意味・根拠・図の関係を維持し、正式export前にcanonicalを直接編集しない。
- メモ: `content -- note create`で固定ページと共通の下書き生成を使う。内部notes・既存ID/URL/公開状態を保ち、任意のdotコメントは既存Calloutで本文と区別する。同じMDXとして確認し、専用の公開経路は作らない。
- ツール: 独立sourceを変更し、固定release/artifactをinstallerのplan/apply/checkで採用する。vendorや生成wrapper/lockを手書きしない。
- スタイル: guideの所有表に従い、専用規則をglobalへ戻さない。色・余白のtokenとroute CSSを区別し、PC/狭幅/focus/必要状態と性能予算を確認する。
- 固定ページ: content/pagesの既存MDXを編集し、ID/routeを保つ。route変更が依頼された場合だけredirect/canonical/discoveryへの影響を扱う。

関連test・typecheckを先に実行し、最終buildと`ci:final`の実artifact検査を通す。同じ条件の有効な証拠は再利用し、無関係な日付・コード差分だけで記事の全面AI監査を要求しない。本文・画像・根拠変更は対応する監査・候補を失効させ、再確認する。

更新前後の挙動、最終head、実行した検証と未検証を報告する。配備済みと確認完了を別に扱い、結果不明の外部操作を再送しない。ダミーは一時workspaceで検証し本番contentへ残さない。

`apps/site/source-inputs`は既存Git原画像9件の保全入力で、新しい記事画像の追加先ではない。現物はcatalog・固定Git・通常CIで照合する。生成画像は既存profileで作り、原画像やcatalogをpublicへコピーしない。
