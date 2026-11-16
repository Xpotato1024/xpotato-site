---
status: proposed
owner: content
last_verified: 2026-11-15
---

# 工学素材を実データから制作する

[一貫制作手順](content-production.md)の素材制作で必要なrecipeだけ使う。単純な関係の説明は[技術ビジュアル](technical-visuals.md)のMermaid/グラフでよいが、回路・3D形状・シミュレーションの制作依頼を「それらしく見える図」で代用しない。実機の性能・故障・強度を実行していない解析から保証しない。

## 共通の進め方

対象と読者が知りたい関係、モデル化の範囲、変更/固定条件を定め、既存の利用可能なソフト・版・ライセンスを確認する。編集可能な元sourceと再生成方法、掲載用出力、図の配置とaltを残す。本文は比較の目的と結果を中心にし、制作手順の実況を並べない。

色・文字役割はSiteの共通tokenを参照する。技術的意味を持つ回路記号・線種・寸法は装飾上の都合で変えない。図中のラベルと本文の名称をそろえ、全体像が必要な場合以外は重要な局所を十分な大きさで示す。

## 回路: KiCadを標準候補、解析は必要な場合だけ

既存の回路があれば元の形式・接続を保持する。新規は利用可能なKiCad等の回路設計ソフトで、標準記号、接続点、電源/GND、値・単位・参照番号を明示する。KiCad CLIがある場合の入口は次。実行時は `kicad-cli version` とインストール版の `--help` で引数を照合する。

```sh
kicad-cli version
kicad-cli sch erc --format json --severity-all --exit-code-violations --output <private-dir>/erc.json <source.kicad_sch>
kicad-cli sch export svg --output <private-dir>/figures/ --exclude-drawing-sheet --no-background-color <source.kicad_sch>
```

ERCの違反を表示から隠さず解決または根拠を記録する。ERC通過は回路動作・電流容量・実物安全の証明ではない。電圧/電流/時間波形を述べる場合は、適切なモデル・刺激・境界条件でSPICE等を実行し、出力データをグラフへ結ぶ。

`.kicad_sch`/必要なproject・library、ERC結果、必要なnetlist/model、SVGを非公開制作領域へ保存する。配布時は第三者library/modelの利用条件を確認する。SVGを正規media入力へ通し、外部参照/foreignObject/任意scriptは除くか安全な再exportを行う。

## 3D構造: 編集元、交換形式、描画を分ける

既存Fusion/FreeCAD等のsourceを優先する。新規は利用可能なCADで寸法・拘束・単位を持つモデルを作る。編集元（FCStd等）を正本として保持し、形状交換には必要に応じSTEP、メッシュ用途にはSTL/3MFを別途出す。STLだけを寸法拘束付き編集元と呼ばない。

再読込し、単位、主要寸法、solid/meshの有効性、部品数・向き・変換での欠落を確認する。断面、組立関係、荷重方向、固定箇所、印刷時と使用時の向きを区別する。同じモデル・視点・倍率で比較し、切出しや非表示層を変更しただけなら形状変更と偽らない。

スライスの外周数/充填率/トップ層を示す場合は実スライサーで同じモデルの設定だけ変え、設定・3MF/G-codeを保存し、その出力から図を得る。別viewerで描画した場合はスライサーの実画面と区別する。参考G-codeを実機適合確認済みと扱わない。

## simulationとGIF

物理モデル、版、固定/変更条件、時間刻み、初期値、入力と保存stateを固定する。実行時刻と再生時間は別で、比較ごとに一貫させる。原理を説明する離散ストロボと、実現象を見せる描画GIFを目的で選ぶ。

保存されたstate/実フレームから画像列を作る。過去の輪郭と現在の実体、時刻、向きを区別し、ループのリセットを物理的復元に見せない。観測していない中間状態、逆再生、別solverの結果で現象を補作しない。

生成した動く画像とposterは[動く記事媒体](animated-article-media.md)の正規取込みへ渡す。現在の共通配信形式への変換、フレーム/保持時間/loopの検査、停止/reduced-motion、容量、PC/狭幅での可読性を確認する。GIF形式の納品指定を黙って別形式のみへ置換せず、原入力とSite配信形式を区別する。

## 配布物と検証

元データは再利用できる形で残し、公開するものだけを別にまとめる。ソース、依存・版、再生成コマンド、必要条件とライセンスを付ける。不要なユーザー名・絶対path・ログ・API key・EXIF・作業中ファイルを混ぜない。

ZIP等は展開して内容を確認し、path traversal/symlink/不要な実行ファイルを混ぜない。公開可能性は拡張子だけで決めない。内容/サイズ/hashを固定し、ダウンロード先から同じbytesが取得できるまで登録完了と呼ばない。画像系のR2 object schemaへ非画像を偽装せず、対応する配布経路を使う。

このrecipeの記載はソフトの導入・実行・実機検査の証拠ではない。実行したcommand、入力/出力、結果と未実施範囲を既存Job/PRに残す。必要な道具が利用できない場合は環境・互換手段を調査し、解決できる範囲を続ける。架空の実物で埋めない。

## 選定根拠

- KiCad CLI: https://docs.kicad.org/9.0/en/cli/cli.html （ERC/回路図SVG出力。使用版のhelpを優先）
- FreeCADの交換形式: https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Part_Export.md
- 表示の共通基準: [ページ構成](../content/page-composition.md)、[図版標準](../content/figure-standard.md)
