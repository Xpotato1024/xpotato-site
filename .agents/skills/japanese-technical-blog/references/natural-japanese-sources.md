# 自然な日本語の参考スキルと採用判断

確認日：2026-10-28。以下は公開リポジトリの固定版を読んだ編集手法の比較であり、効果の実証ではない。外部スキルの全文や実行コードを取り込まず、判断基準を独自に記述した。外部スキルを同時に自動起動しない。

## nanaism/yomiyasu

- 固定コミット：`41e5aec228f080fe24e5f795efee2ac3fda61839`
- ライセンス：MIT（同リビジョンのLICENSEを確認）
- 参照：[skills/yomiyasu/SKILL.md](https://raw.githubusercontent.com/nanaism/yomiyasu/41e5aec228f080fe24e5f795efee2ac3fda61839/skills/yomiyasu/SKILL.md)
- [LICENSE](https://github.com/nanaism/yomiyasu/blob/41e5aec228f080fe24e5f795efee2ac3fda61839/LICENSE)
- 採用：意味・比重・条件・断定の強さ・文の働きを保つ。主述、修飾、接続の関係を確かめる。
- 不採用：文長や読点数、見出しの形を一律に指定する部分は採用しない。

## coji/natural-japanese

- 固定コミット：`c7dd502a6c93428ab5bd7cac7e993643a7391a21`
- ライセンス：MIT（同リビジョンのLICENSEを確認）
- 参照：[skills/natural-japanese/SKILL.md](https://raw.githubusercontent.com/coji/natural-japanese/c7dd502a6c93428ab5bd7cac7e993643a7391a21/skills/natural-japanese/SKILL.md)
- [LICENSE](https://github.com/coji/natural-japanese/blob/c7dd502a6c93428ab5bd7cac7e993643a7391a21/LICENSE)
- 採用：読者と目的、段落ごとの具体性、説明の濃淡、lintと編集判断の分離。自然な原文の保持。
- 不採用：必ず結論先行、全見出しを結論にする指示や構文回数の目標は採用しない。実測されていないスコアを合否にしない。

## matsutouya/humanizer-ja

- 固定コミット：`b4edf87d98ab81f8a2f5068e9641a50ea4a141d6`
- ライセンス：MIT（同リビジョンのLICENSEを確認）
- 参照：[SKILL.md](https://raw.githubusercontent.com/matsutouya/humanizer-ja/b4edf87d98ab81f8a2f5068e9641a50ea4a141d6/SKILL.md)
- [LICENSE](https://github.com/matsutouya/humanizer-ja/blob/b4edf87d98ab81f8a2f5068e9641a50ea4a141d6/LICENSE)
- 採用：別のhumanizer定型に置き換わる危険、過剰な演出や同語の不必要な言い換えへの注意。
- 不採用：一人称・感情・数字の追加、語尾poolのランダム運用、伝聞の断定化、接続詞の全削除は採用しない。例文の体験や数値を事実として流用しない。

## blader/humanizer

- 固定コミット：`0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0`
- ライセンス：MIT（同リビジョンのLICENSEを確認）
- 参照：[SKILL.md](https://raw.githubusercontent.com/blader/humanizer/0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0/SKILL.md)
- [LICENSE](https://github.com/blader/humanizer/blob/0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0/LICENSE)
- 採用：空疎な強調、宣伝調、チャットの残滓を内容に照らして点検する。
- 不採用：英語の頻出語一覧を日本語へ機械的に移植しない。文体を理由に筆者の立場を作らない。

## textlint-ja/textlint-rule-preset-ai-writing

- 固定コミット：`45bb6485062b96a8578c5fa6ae37a41de01d9b80`
- ライセンス：MIT（同リビジョンのLICENSEを確認）
- 参照：[README.md](https://raw.githubusercontent.com/textlint-ja/textlint-rule-preset-ai-writing/45bb6485062b96a8578c5fa6ae37a41de01d9b80/README.md)
- [LICENSE](https://github.com/textlint-ja/textlint-rule-preset-ai-writing/blob/45bb6485062b96a8578c5fa6ae37a41de01d9b80/LICENSE)
- 採用：機械的な強調や反復構造を検出候補にする発想。
- 不採用：著者がAIかどうかの判定器として使わない。必要な箇条書きやSVGアイコンを一律に禁じない。今回依存関係へは追加しない。

## 適用上の優先順位

事実・技術的意味・依頼された文体の保持を、表面的な自然さより優先する。具体性を出すには資料が必要で、推敲だけで欠けた実測・写真・経験は作れない。新規執筆の根拠調査と既存原稿の表現編集を区別する。参照元の更新を自動追従せず、採用する判断が変わる場合だけ再確認する。
