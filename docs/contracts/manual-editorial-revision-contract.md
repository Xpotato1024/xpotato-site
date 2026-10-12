---
status: canonical
owner: content
last_verified: 2026-10-05
canonical_for:
  - manual fixed-page revisions over immutable migration evidence
---

# Manual Editorial Revision Contract

ADR-0035に基づく、今回の固定ページ編集の機械契約です。通常のBlog更新は既存のArticle Job / approval / publication契約に従います。この契約は記事の公開、媒体の永続化、provider activationを許可しません。

## 移行証跡と現行本文

Phase 4/5のmanifest、legacy snapshot、taxonomy reviewを改変せず、53件の移行基準を毎回再生成します。現行本文が移行原文と異なる固定ページだけを `docs/content/manual-editorial-revisions-v1.json` へ記録します。本文は既存MDXが唯一の表示源です。テンプレートに本文の代替コピーを持ちません。

各編集は、移行原文のSHA-256、同じtargetPath、編集理由、`origin: manual`のPublication Provenance、現行MDX/parsed frontmatterのhash、ContentIdとrouteを結びます。公開リポジトリ由来の説明には、確認したcommit/path/README hashを残します。これは手動編集の出典であり、Article Jobや独立監査の履歴を生成したことにはしません。ソースの全文、個人情報、会話IDは保存しません。

本文のbeforeは凍結済み原文から再生成でき、afterはcanonical MDXとGit diffで確認できます。元の移行manifestの最終hashを現行本文に合わせて書き換えることは禁止します。後続改訂も旧provenanceをGit履歴に保持し、レビュー可能な差分と新しい出典を記録します。

## 検証境界

- 記録なしの変更・欠落は、従来どおり53件全件の一致検証で失敗する。
- 編集先はpages/projects/tools/notesの既存単層MDXに限定し、Blogを対象にしない。
- ContentId、title、path/route、draft、publication date、taxonomy、status、links、SEOなどの保護metadataは保持する。今回変更できるfrontmatterはdescriptionとupdatedDateのみ。
- media参照とDemo bindingは保持する。文章の位置変更は可能だが、bindingの追加・削除はこの契約で許可しない。
- 追加Pageは同じledgerのcreatedPagesに手動provenanceを記録し、Page schema、identity、route、本文hashを検証する。今回は教育資料ハブだけを追加する。
- MDXと生成taxonomyの比較/hash入力はUTF-8のLF表現を使う。Windows checkoutのCRLFだけをLFへ正規化し、BOMや内容の違いは許容しない。凍結manifestのhash計算・再生成は変更しない。
- 改訂済み本文をPhase 5 writeで上書きしない。baselineの再materializeは、ledgerに改訂がない隔離された証拠用checkoutで行う。

`migration:taxonomy:materialization:check` がledgerと53件の原文を一緒に検証するため、既存の必須CI経路から外れません。新PageのContentIdは、既存割当器と同じNode `crypto.randomUUID()` で生成します。

## 今回の範囲

About、実在する6制作物、素因数分解機、歴史資料としてのWordPress Migration Playbookを更新します。教育資料は公開資料未提供の状態を正直に説明します。基盤fixtureのnoindex化は移行53件とは別のfixture管理であり、同じURL/IDでSEO overrideの検証を継続します。
