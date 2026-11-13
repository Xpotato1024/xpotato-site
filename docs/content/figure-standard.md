---
status: proposed
owner: content
last_verified: 2026-11-12
---

# 記事の図版標準

実装候補であり本番採用状態は[design-status](../architecture/design-status.md)を正とする。[semantic module契約](../contracts/content-module-contract.md)と[media描画契約](../architecture/media-delivery-rendering.md)のFigureを使う。

## 基本形

**画像 → 必要なら短い図題 → 必要な出典だけ。** GIF等の操作は画像の端に再生/一時停止アイコンだけを配置する。操作説明の文章を付けない。
図の意味や読み取り方は本文で説明する。図内の再生速度・時刻・左右ラベルをcaption・note・本文に繰り返さない。補足は原則使わず、必要な制約だけを本文に含める。制作上の詳細は証拠記録へ分離する。

```mdx
<Figure asset="memory-slot" alt="基板右端のメモリスロットと固定爪" title="メモリスロットの位置" />
```

第三者の画像等で必要な場合だけ、短いcredit/sourceUrlを添える。自作図へ同じクレジットを毎回付けない。権利表示や出典自体を隠す方針ではない。

## 互換性のために保持する属性

| 属性 | 用途 |
| --- | --- |
| `alt` | 必須の簡潔な代替説明。可視説明の重複を減らしても、省略しない。 |
| `title` | 任意の短い図題。trim後1〜120文字（JavaScript文字列長）。番号は強制しない。 |
| `caption` | 既存記事との互換用の任意説明。新規記事では本文を優先し、既定で埋めない。 |
| `note` | 例外的に必要な補足のみ。trim後1〜600文字。画像内情報の反復には使わない。 |
| `credit` / `sourceUrl` | 必要な著作者・出典だけを短く表示する。既存HTTPS検証を保持。 |

plain textのescapeと入力検証は維持する。旧caption/noteを勝手に隠すのではなく、記事編集時に重複や不要な説明を除く。指定された属性だけを単一のfigcaption内に表示し、空のブロックは作らない。画像の認可・根拠・保存契約は変えない。

## 再生・停止

再生中は一時停止記号、停止中は再生記号を出す。44px以上の操作領域を確保しつつ、視覚上は小さくする。画像内の情報を覆わない端へ配置する。可視文言や「再生できます」という説明は置かない。
`button`のaria-labelで操作名を伝え、キーボード/focusとreduced-motionの静止初期表示を維持する。GIF等が動作しない場合も意味の分かるposterとaltを保つ。

## 検査

本文・画像内文字・図題・属性を一緒に読み、同じ情報を二度説明していないか確認する。特に速度・時刻・左右対応・操作説明の重複を検査する。PC/狭幅の実表示で図より周辺情報が目立たないことを確認する。

正式な動きは Media Registry の `delivery.mode="animated"` と `posterAssetId` で解決します。停止中は監査した poster を表示し、再生は先頭から再開します。記事本文の Figure に専用 props や script を追加しません。処理・監査・保存の境界は[動く図版の手順](../operations/animated-article-media.md)を参照してください。
