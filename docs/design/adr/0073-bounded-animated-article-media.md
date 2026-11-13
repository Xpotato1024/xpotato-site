---
status: proposed
date: 2026-11-13
---

# ADR-0073: 動く記事図版を共通のメディア経路で扱う

## 背景

記事レビューで使ったシミュレーション GIF と停止画像は、そのままでは正式 Article Job の静止画専用 ingest / 配信検査を通りません。先頭フレームへの暗黙の変換や、記事だけの public ファイル差し替えでは、本人が確認した動作・原本・保存と復旧の来歴を保てません。既存の 12 図上限も、16 図を使う記事と animation の静止 poster の正式監査に不足しています。

## 決定候補

1. GIF / animated WebP を明示的な inline 入力として扱い、専用の lossless animated WebP profile を追加します。既存の静止 v1 profile は変更しません。
2. 原本・配信 object の実際の frame / delay / loop を記録します。同一画素が連続する待ち時間だけは encoder の統合を許し、全表示区間の RGBA、時刻境界、総時間、loop を比較して意味が変わっていないことを検査します。
3. 静止 poster を独立した通常の inline asset として監査・保存します。本文の参照から `posterAssetId` をたどる閉包を検証し、追加の無関係な画像や循環は認めません。元と poster の比率を一致させます。
4. 図版のみの汎用 renderer で自動再生、記号の停止・再生、reduced motion、JavaScript 無効時の静止表示を実装します。本文固有の runtime import や挙動差し替えを増やしません。
5. poster を含む inline 上限を共通定数 24 とし、source / canonical / render context の関連上限をそろえます。画像単体・全 package・外部監査入力・保存権限の上限は維持します。
6. 原本から最大 12 枚の時系列 contact sheet を固定サイズ枠で作り、全フレームの機械検査に加えて独立した視覚監査へ渡します。

## 代替案

- GIF を記事専用 URL で公開する方法は、正規の権利・原本・公開・保護の集合から外れるため採用しません。
- 静止画へ置換する方法は、記事の比較内容を変えてしまうため採用しません。
- 全入力フレームを独自 WebP mux で保持する方法は、同一画素の待ち時間にも不要な frame を残し、専用 container writer を増やします。完全な表示同値を検査できる通常 encoder を使います。
- video / MP4 / 任意の animation script は範囲外です。

## 検証と採用境界

操作は元の画像と同じ Figure / Media Registry を使います。全 frame の壊れた入力、時間だけが同じ不正変換、画素・loop の変更、未宣言 animation、欠落 poster、異なる比率、巨大な contact sheet を拒否します。通常表示、停止・再生、キーボード、reduced motion、JavaScript 無効を実ブラウザーで確認します。

これらは実装候補です。監査 PASS・本人承認・main admission・保護 Environment・R2 の A/B/C 実保存と read-back・export・merge・deploy の条件を省略しません。プロファイル・registry・実 bytes の変更に伴う既存承認の失効を正規の経路で扱います。

操作と限界は[動きを含む記事図版](../../operations/animated-article-media.md)を参照します。
