---
status: proposed
owner: content
date: 2026-10-29
---

# ADR-0058: Blogの単一主分類階層と横断タグ、SNS画像の共通接続

既存schemaの単一categoryと複数tagsを保ち、主分類に任意parentId（最大3段）を追加する。記事／分類archive URLへ祖先パスを含めず、再分類とURL継続を分離する。親archiveの子孫集約、パンくず、表示labelに同じ階層解決を使う。

SNS metadataは公開安全なcompact Media Registry／Provenance／Rightsから導出し、private receipt・jobの再読込やhero fallbackを追加しない。カードの見た目と具体的分類データは未採用。

比較、理由、影響範囲、公開フロー、未実装境界は[一体案](../blog-foundation-20261029.md)に記載。分類付き記事URL・複数主分類・未承認カードの自動採用は選ばない。本ADRは本人の設計採用、merge、記事公開、provider操作を自己承認しない。

## SNSカードの本人選択（2026-10-29）

比較後、本人はCを選択した。通常のBlog social生成はC固定とし、表示専用cardDisplay.linesを許可する。カテゴリ体系の採用や記事・画像の公開はこの選択へ含めない。実装・保留条件は[標準SNSカードC](../../operations/blog-social-card.md)を参照。

## 記事metadataの本人選択（2026-10-30）

本人は主分類「工作→3Dプリンタ」と技術タグ「FDM/FFF」を選択し、記事の種類・目的の概念タグも求めた。今回の本文は形状・設定の選択と破損状態からの見直しを扱うため、「設計」「トラブルシューティング」の2件を付ける。未実施の強度試験・製品レビュー・手順tutorial等を追加しない。

purposeタグをtechnology／topicと区別し、本文では「技術タグ」「記事の目的」「関連テーマ」を分けて表示する。既存troubleshooting IDを再利用し、主分類やURL階層へ混ぜない。元のContentIdと本文は保持する。

最初のslug選択は`fdm-strength-settings`。その後本人から`/articles/<自動ID>/`の検討依頼があり、[URL設計案](../article-url-identity-20261030.md)を別途確認中。現行`/blog/`のrouting実装は維持し、metadata選択からURL方式変更・記事公開・PR123 mergeの許可を導かない。
