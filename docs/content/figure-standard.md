---
status: proposed
owner: content
last_verified: 2026-11-12
---

# 記事の図版標準

このブランチで追加する再利用可能なSite authoring/rendering標準。未mergeの実装候補であり、本番配信・設計採用・人間の読者テストの記録ではない。採用状態の正本は[design-status](../architecture/design-status.md)。既存の[semantic module契約](../contracts/content-module-contract.md)と[media描画契約](../architecture/media-delivery-rendering.md)のFigureに適用する。

## 入力と役割

```mdx
<Figure
  asset="memory-slot"
  alt="基板右端のメモリスロットと固定爪"
  title="メモリスロットの位置"
  caption="固定爪の位置を確認してから、メモリを取り外します。"
  note="電源とケーブルを外した状態で作業します。機種によって爪の形が異なります。"
  credit="撮影：著者"
  sourceUrl="https://example.com/manual"
/>
```

例のassetとURLは説明用。実際には現在のContentIdの登録assetと確認済み出典を使う。import・任意JSX・CSS属性・provider URLで登録経路を迂回しない。

| 属性 | 内容 |
| --- | --- |
| `alt` | 画像の代替となる簡潔な説明。図題・キャプションの代用にせず、長い補足を重複させない。既存の必須条件を維持する。 |
| `title` | 任意の短い図題。前後空白を除去して1〜120文字（JavaScript文字列長）。太字で表示する。番号は自動付与しない。 |
| `caption` | 既存の任意の説明文。何を見るか・どう読むかを伝える意味を維持し、図題へ転用しない。 |
| `note` | 任意の適用条件・制約・注意。前後空白を除去して1〜600文字（JavaScript文字列長）。可視ラベル「補足：」を付ける。 |
| `credit` / `sourceUrl` | 著作者・撮影者等と出典。説明文から独立した一行に表示し、他の説明がなくても省略しない。URLの既存HTTPS検証を維持する。 |

本文属性はplain textとしてescapeする。属性内のMarkdown/HTMLを装飾として解釈しない。`title`と`note`を指定する場合、空文字・空白だけ・上限超過はschema、portable MDX検証、Figure描画で拒否する。caption等の既存入力条件は変更しない。

## 描画と見た目

読み順は **media → mediaが持つ任意のmotion controls → 一つのfigcaption**。figcaption内は図題（strong）、説明文（p）、補足（p）、credit/source（p）の順とし、存在する属性だけを出す。figcaptionはfigureの最後の子で、図題を記事のh2/h3や別の見出しroleへ昇格させない。ロゴ・旧図版へ空の図題や図番号を強制しない。全属性未指定ならfigcaptionを作らない。

Site所有の`.article-figure`と`__title` / `__caption` / `__note` / `__source`で階層を統一する。本文用の`article-modules.css`が所有し、既存の前景・補助文字tokenを使う。図題と説明を主に、補足と出典を従にし、背景カードや囲いを追加しない。段落余白の調整はこのfigcaption直下に限定する。content/compactおよび既存Galleryの幅、狭幅の折返し、themeの意味色、登録mediaの寸法・遅延読込・controlsを維持する。追加のclient runtimeは不要。

題名・説明・条件・出典を画像内へ焼き込まず、この属性で保持する。図の事実性・根拠・権利・承認・保存は既存のmedia/Article Job gateに従い、この標準で認可を追加しない。
