---
name: update-site
description: xpotato-siteの既存記事、ツール、固定ページ、サイトスタイルを更新するときに、正本と変更範囲を選び既存CLIで検証する。新しい公開権限やprovider設定を与えない。
---

# サイトを更新する

[編集経路](../../../docs/operations/content-workflows.md)から最も狭い入口を選ぶ。記事の制作は `japanese-technical-blog`、ツールの制作は `create-browser-tool` が[一貫制作手順](../../../docs/operations/content-production.md)で最後まで担当する。このSkillは正本と影響範囲の選択を支援する。まず対象ファイル・現在のID/URL・既存変更と公開状態を確認する。

- 記事: 執筆由来を保ち、人間稿は`article init --authoring human --content-id <UUID> --update-kind <kind>`、AI改稿は新しいimmutable intakeをstageして`article existing-input init --content-id <UUID> --input-sha256 <hash> --update-kind <kind>`へ進む。元本文/Registryを固定し、修正対象の意味・根拠・図の関係を維持する。AI稿をhumanへ戻さず、正式export前にcanonicalを直接編集しない。
- メモ（ADR-0068の未採用候補）: `content -- note create`で固定ページと共通の下書き生成を使う。内部notes・既存ID/URL/公開状態を保ち、任意のdotコメントは既存Calloutで本文と区別する。同じMDXとして確認し、専用の公開経路は作らない。
- ツール: 独立sourceを変更し、固定release/artifactをinstallerのplan/apply/checkで採用する。vendorや生成wrapper/lockを手書きしない。
- スタイル: guideの所有表に従い、専用規則をglobalへ戻さない。色・余白のtokenとroute CSSを区別し、PC/狭幅/focus/必要状態と性能予算を確認する。
- 固定ページ: content/pagesの既存MDXを編集し、ID/routeを保つ。route変更が依頼された場合だけredirect/canonical/discoveryへの影響を扱う。

更新種別は誤りの訂正なら `correction`、情報の現行化は `refresh`、説明の追加は `expansion`、構成変更は `restructure`、本文不変のtitle/description/taxonomyは `metadata_only`、本文事実不変の画像差替えは `media_only` を選ぶ。[更新契約](../../../docs/contracts/article-update-contract.md)で監査と日付への影響を確認し、複数範囲の変更を軽い種別へ偽装しない。

関連test・typecheckを先に実行し、最終buildと`ci:final`の実artifact検査を通す。同じ条件の有効な証拠は再利用し、無関係な日付・コード差分だけで記事の全面AI監査を要求しない。本文・画像・根拠変更は対応する監査・候補を失効させ、再確認する。

更新前後の挙動、最終head、実行した検証と未検証を報告する。配備済みと確認完了を別に扱い、結果不明の外部操作を再送しない。ダミーは一時workspaceで検証し本番contentへ残さない。

`apps/site/source-inputs`は既存Git原画像9件の保全入力で、新しい記事画像の追加先ではない。現物はcatalog・固定Git・通常CIで照合する。生成画像は既存profileで作り、原画像やcatalogをpublicへコピーしない。
