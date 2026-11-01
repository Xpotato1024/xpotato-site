# Reviewed publication admissions

`scripts/media-publication.ts prepare` が正式Jobの実内容・画像監査、runtime journal、原文・根拠・権利・全画像bytesを再検証した出力の `*.admission.json` を、対象ContentIdの `<UUID>.json` として通常PRでreview/mainへ採用する。私有Job/資料本文/会話ID/鍵は含めない。

これは新しい人間監査PASSやAI署名の捏造ではなく、検証済みproducer出力をtrusted-mainへ採用する通常のrepository境界。package内の自己申告hashやowner dispatchだけで代用しない。任意JSONをadmissionへ登録する別CLIは設けない。CIは完全package SHA、semantic SHA、ID、監査・producer来歴をmainの実Git blobと取得時/保存前の両方で一致させる。欠落・変更は保存前に拒否する。

現時点で実記事のadmissionは未登録、Secrets/有効化Variableも未設定。日付だけでpackageを作り直さず、export時のJST投影を使う。実保存/公開未完。
