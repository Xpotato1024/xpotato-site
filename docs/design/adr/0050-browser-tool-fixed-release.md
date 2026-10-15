---
status: proposed
owner: architecture
date: 2026-10-15
---

# ADR-0050: ブラウザツールのsourceとreleaseを固定して取り込む

独立repoの更新を通常site buildへ混ぜず、reviewしたcommit・lock・license・配布manifest/bytesをpinにまとめる。[取り込み契約](../../contracts/browser-tool-adoption.md)に従い、vendorはrelease単位で追加、更新/差し戻しは明示的なfile dependencyとimport/registry変更をreviewする。

ready後の通信不要はCSPの宣言だけでは判定できない。初期assetと操作時を分け、CDP・server trace・offlineの実操作で検証する。実ツール未選定の間は合成fixtureでsource→vendor→file lock→Astro React islandの接続を検証する。fixtureを公開catalogへ登録せず、外部release受入れ実績とは分ける。既存素因数分解のidentityと挙動は維持する。

本記録は実装候補の理由であり、実ツール選定・本番配信・新repo/release作成を承認しない。
