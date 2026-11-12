# 編集回帰ケースの使い方

`reader-first-visual.json`は更新紹介・工作記事の原因を一般化したケース、`definition-placement.json`は同じ指標でも節の役割により配置が変わるケース。既存`natural-japanese.json`は従来の文体/意味保存ケース。

自動テスト `packages/article-pipeline/src/editorial-skill-reference.test.ts` はケース構造、ID、参照導線、固定監査bundleを検査する。候補文の意味や読者理解を自動判定するテストではない。

意味の確認では別のfresh contextに、今回のSkill/reference snapshotとcaseのcontext/candidateだけを渡す。`accept`/`reason`と、判定を示唆する元IDは渡さずランダムな中立IDへ置換する。返された判定と根拠を期待値へ照合し、不一致は規則・候補・判定のどこに原因があるか確認する。正解へ合わせるだけの後付け変更はしない。

比較の補助指標、指標自体が主題、説明済みの読者、表より前で理解が必要なケース、RTF以外の題材を含める。新しい失敗原因が分かったときは例と期待理由を加える。旧反例を採用ルールとして残さない。

記録するのは対象commit/関連差分、ケース集合、実施範囲、判定結果、不一致と修正範囲。rawのモデル内部思考や会話全文は保存しない。単体test・モデルの編集判断・ユーザーの再指摘回数を混同しない。必要な独立性/開示許可は既存workflowに従う。

次回記事の効果は初稿での同じ原因の再指摘で確認する。特定の版番号や、このcase集合での正解率だけから「FBを何回削減できる」と保証しない。

`reader-first-visual.json`の`integrated-*`は初稿制作workflowの回帰例。検索別名、H1/検索title、全description出力、元hero保持、局所crop、実データ/模式、設計範囲、初出用語と症状の図、任意endnoteと結論、RTFの文脈、再現資料と本文、数値条件をaccept/rejectの対で扱う。contextとreasonも読み、固定語句の有無で記事を自動合否判定しない。Vitestはcaseの構造・参照・期待ラベルの保持を検査するだけで、意味評価や可読性実験ではない。
