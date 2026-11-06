---
status: proposed
owner: frontend
date: 2026-11-06
---

# ADR-0069: ホーム制作物カルーセルの限定的な拡張

ユーザー指定の中央カード・隣接カードの見切れ・自動送り・循環表示を、静的な制作物リンク一覧へのprogressive enhancementで実装する。本PRのレビュー対象であり、本番採用・配信の認可を表さない。

PCでは中央カードと左右の見切れを保ち、隣接部分だけを背景色のグラデーションへ溶かす。前後の44pxボタンは左右の見切れ部分へ重ね、フェードの上に不透明に表示する。760px以下は全幅1枚とし、見切れ・フェードをなくして前後操作をカード下へ移す。下部中央の44px再生／停止アイコンはaccessible name・title・focus表示を持ち、hover/focusによる一時停止とは別に利用者の停止選択を維持する。

hover可能なfine pointerのPCでは、再生中の回転操作をvisibilityで隠し、hover/focus-within時だけ表示する。非表示時はTab対象にならず、最初の前ボタンへfocusすると次のTabで回転操作へ進めるDOM順とする。操作領域は常に確保してlayoutを動かさない。利用者が明示停止した場合は離れても再開アイコンを表示し続ける。hoverのない大画面・coarse pointer・モバイルでは回転操作を常時表示する。

ホームの`ProjectCarousel.astro`だけに、依存なしの単一Astro生成moduleを認める。実出力の部品との一対一対応、ホーム以外への混入、重複・未知script、import・network・storage・動的codeを検査し、専用上限をraw 8000 bytes / gzip 3000 bytesとする。他の通常routeの専用JS予算ゼロ、React非搭載、検索・Toolの隔離を維持する。

6秒ごとの送りは、一時停止操作・hover・focus・pointer操作・非表示タブ・画面外で止める。reduced motionでは自動送りと移動animationを停止し、前後・左右キー・Home/End・swipeは残す。端の複製カードはinert/aria-hiddenとし、現在の実カードだけを操作対象にする。0件は空表示、1件は静的表示、2件から循環させる。JSなしでは元の横スクロール可能なリンク一覧を保持する。

通常の`release:interaction`で実distの中央配置・隣接カード・前後境界・keyboard・touch・停止条件・reduced motion・少数データと末尾罫線を検査する。合成0/1/2件のrouteはloopback host内だけに存在し、dist・公開manifestへ保存しない。
