# 旧operator方式の回帰モデル

この3組の実装・試験は、以前検討した短期sessionとHTTP adapterの失敗境界を再現するためのものです。package index、通常CLI、workflowから実transportとして使いません。fixture writerとsession factoryは`operator_runtime`を拒否する既存条件を維持します。

現在の保存経路は`publish-article-media.yml` → `tools/publication/media-publication.ts` → `publication/ci-publication.ts` → `media/r2-sdk-store.ts`です。独自署名・broker・鍵入力経路をここへ追加しません。

既存`inspect-session`の読取り検査は`media/session-descriptor.ts`を使い、provider実観測、承認、資格情報、live実行可能性を成立済みとは返しません。ABCのbytes照合は現役の`media/media-persistence.ts`・`media/media-readback.ts`が所有します。

ここに残す試験は、期限、exact key、未知PUT結果、redirect、body上限、callback改変、非fixtureの拒否を検証します。過去モデルを現在の運用手順として扱わないでください。
