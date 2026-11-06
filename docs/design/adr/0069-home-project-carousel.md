---
status: proposed
owner: frontend
date: 2026-11-06
---

# ADR-0069: ホーム制作物カルーセルの限定的な拡張

ユーザー指定の中央カード・隣接カードの見切れ・自動送り・循環表示を、静的な制作物リンク一覧へのprogressive enhancementで実装する。本PRのレビュー対象であり、本番採用・配信の認可を表さない。

PCでは中央カードと左右の見切れを保ち、隣接部分だけを背景色のグラデーションへ溶かす。前後の44pxボタンは左右の見切れ部分へ重ね、フェードの上に不透明に表示する。760px以下は全幅1枚・見切れなしとし、常時の矢印と開閉パネルを置かない。両layoutでカード下中央に位置・移動先を示すドットを並べ、脇に枠なしの停止／再開アイコンを置く。ドットは8pxの輪郭／塗りつぶしと32×44pxの独立target、停止操作は44px。320pxの6項目でもカード幅を削らず、増えたドットは折り返す。各操作はaccessible name・title・focus表示を持ち、hover/focusによる一時停止とは別に利用者の明示停止を維持する。

hover可能なfine pointerのPCでは、再生中の回転操作をvisibilityで隠し、hover/focus-within時だけ表示する。非表示時はTab対象にならず、前ボタン・ドット群・回転操作・次ボタンのDOM順で操作する。停止操作の領域は常に確保してlayoutを動かさない。利用者が明示停止した場合は離れても再開アイコンを表示し続ける。hoverのない大画面・coarse pointerとモバイルでは回転操作を常時表示する。ドットfocusは幅切替でも保持し、モバイルで隠れる前後ボタンのfocusは現在ドットへ移す。

ホームの`ProjectCarousel.astro`だけに、依存なしの単一Astro生成moduleを認める。実出力の部品との一対一対応、ホーム以外への混入、重複・未知script、import・network・storage・動的codeを検査し、専用上限をraw 8000 bytes / gzip 3000 bytesとする。他の通常routeの専用JS予算ゼロ、React非搭載、検索・Toolの隔離を維持する。

6秒ごとの送りは、一時停止操作・hover・focus・pointer操作・非表示タブ・画面外で止める。reduced motionでは自動送りと移動animationを停止し、前後・左右キー・Home/End・swipeは残す。端の複製カードはinert/aria-hiddenとし、現在の実カードだけを操作対象にする。0件は空表示、1件は静的表示、2件から循環させる。JSなしでは元の横スクロール可能なリンク一覧を保持する。

モバイルの接触はpassive touch eventsで保持し、縦scrollに伴うpointercancelだけでは接触停止を解除しない。指を離す・cancelする・swipeやドット操作を完了する後は、次の表示を6秒から数え直す。現在ドットの再選択でもintervalを更新する。touch由来の互換mouse hoverと残留focusでは停止を固定せず、明示停止と新たなkeyboard/assistive focusは維持する。ドットはaria-currentと移動先の名前を持ち、Tab/Space/Enterに加えて左右/Home/Endで選択とfocusを移す。離れた項目への直接移動は長距離を高速で流さず、animationなしで確定する。

通常の`release:interaction`で実distの中央配置・隣接カード・前後境界・keyboard・touch・停止条件・reduced motion・少数データと末尾罫線を検査する。合成0/1/2件のrouteはloopback host内だけに存在し、dist・公開manifestへ保存しない。
