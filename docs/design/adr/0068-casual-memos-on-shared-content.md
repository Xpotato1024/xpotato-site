---
status: proposed
owner: development
date: 2026-11-04
---

# 日常のメモを共通コンテンツ基盤で扱う

本人の要望は、Articlesとは別に日常や思いつきを気軽に残し、任意でdotの短いユーモアのあるコメントを添えられる場所。枠組みの実装候補であり、本文・コメントの生成や公開、本番受入れの承認ではない。

表示名を「メモ」とし、既存 `notes` collection・schema・ContentId・URLを保持する。名前だけのmigrationはしない。共通ArchivePageの日付・description抜粋一覧、NoteDetail / ContentLayout、静的検索、SEO、sitemap、関連計算を再利用する。技術テーマを入力条件にせず、管理されたtaxonomyへ `everyday` を追加して下書きの初期値とする。画像・長文構成は不要。

固定ページの既存下書き生成を共有関数へ抽出し、同じCLIへ `note create` を追加する。collection別のschemaを使い、UUID・draft強制・上書き禁止・path/symlink・重複ID/route・redirect・taxonomy検査を共有する。記事は既存Article Job、toolは既存installerを使い続け、メモ用の公開・保存・reviewバイパスは作らない。

dotのコメントは既存Calloutに「dot のひとこと（AIコメント）」のラベルを付け、同じMDX内の補足として保持する。任意であり、自動生成・外部AI呼出し・runtime・独自の承認や公開状態を追加しない。本文と一緒に差分を確認する。

RSSは既存の単一rendererとcatalogで、索引可能な記事とメモの抜粋を同じ最大20件・日付順で生成する。GUIDは従来どおりContentId由来。既存公開ノートも元の日付で含まれるが、本文・日付・ID・URL・来歴は変更しない。noindex fixtureを索引可能にせず、旧44記事のdraftとpublication holdを維持する。履歴文書・凍結migration証跡は書き換えず、現行の検証期待だけを更新する。

検証は実CLIからの下書き隔離、本文だけ/コメント付きの合成メモ、共通discovery・RSS・sitemap・検索・SEO・manifest、既存記事/tool/page経路の回帰、PC/狭幅表示を対象とする。fixtureは一時worktreeにのみ作り、通常contentへ残さない。配信やprovider操作は行わない。
