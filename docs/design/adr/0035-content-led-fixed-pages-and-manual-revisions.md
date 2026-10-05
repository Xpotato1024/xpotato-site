---
status: accepted
date: 2026-10-05
owner: frontend
---

# ADR-0035: 内容を主役にした固定ページと手動編集の証跡

## Context

ホームの見た目はADR-0034で合意済みです。一方、固定ページには実装基盤の紹介文や古い移行案が残り、訪問者が活動や制作物を理解しにくい状態でした。固定ページを整える範囲は明示的に認可されています。53件の移行原文一致検証を無効化して本文を更新することはできません。

## Decision

ナビゲーションはArticles / 教育資料 / 制作物 / ツール / About / 検索とします。Notesは補助導線です。Articlesは表示名であり、`/blog/`、ContentId、taxonomy namespace、検索collectionを変更しません。

教育資料は `/education/` の独立したPageハブにします。理科・数学・情報・資格を扱う入口として、現在公開資料がないことを明示します。未提供分野の空ページは増やさず、関連する素因数分解機へ案内します。非公開資料や保留記事の本文を使いません。

AboutはXpotatoのロボティクス・プログラミング・ものづくりの活動と公開制作物を短く紹介します。新しい実名、所属、連絡先、顔写真は追加しません。制作物は既存6件の目的・機能・設計・技術・現状・公開repoを説明します。CSV2Gのサイト上のarchived状態は保持します。Pandocker-Xは現行READMEのRust製Windowsバイナリ/WSLとUnixソース配布を説明し、旧PowerShell主体の紹介を採用しません。

ツールは操作UIを説明より先に置きます。素因数分解のアルゴリズム、Numberへの変換と整数判定、`3.0`や`2^53`の受付、無効入力時の前回結果保持を変えません。入力を書き換えたとき、現在の結果が前回実行分であることをstatusで知らせます。旧移行ノートは歴史資料として扱います。

vNext基盤fixtureは同じID/URLで保持し、noindexで公開一覧・検索・RSS・sitemapから除外します。SEO override、runtime isolationの検証は残し、実在するAbout/教育資料などの静的出力検証を増やします。

MDX本文の改訂には[Manual Editorial Revision Contract](../../contracts/manual-editorial-revision-contract.md)を使います。移行manifestと凍結原文を保存したまま、手動provenanceと出典commitに現在の本文を結びます。テンプレートへの二重本文やbaseline hashの更新による回避は採用しません。

## Preserved visual direction

XP + Xpotato.net、紫、余白、大きなNoto Serif / Noto Serif JP見出しとZen Kaku Gothic New本文、全幅の元写真、同じ重さの2行 `Think. Build.` / `Run.` はADR-0034のままです。写真はローカルレビュー専用で、Git/CI/本番には媒体を追加しません。

## Acceptance criteria

- PC/スマホで6項目のナビゲーションと補助Notes、skip link、focus、繰り返し遷移と戻るが機能する。
- 教育資料の未公開状態、About、6制作物、ツールと歴史ノートが内容から理解できる。
- 既存URL/ID、metadata derivation、search、held/draft、migration、安全な静的配信とCSPを保つ。
- Phase 4/5の原文証跡・改訂ledger・source refsが検証され、必須source/build/final checksが通る。
- 実画面をdesktop、390px、320pxで確認し、横溢れ・文字欠け・操作不能を残さない。安全な合成記事でlist/detailを確認する。
- 同じDraft PRでexact-head CIを確認する。merge/deploy/provider変更は行わない。

## Consequences and remaining gates

固定ページの編集もレビュー可能なcanonical MDXで管理できます。追加の一般的なCMSやライブラリは導入しません。教育資料の実体は将来の編集作業です。保留中44記事、migration mediaのprivate/public/protected persistence・read-back・復旧、publication/final cutoverは、このfrontend PRとは別のgateです。今回の認可はサイト全体の完成や本番公開を意味しません。
