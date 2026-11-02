# 公開記事画像と配信前検査の接続

通常buildは、公開済みcatalog（noindexの記事も含む）に対応するMedia Registryと`publishedMediaEvidence`を既存の`assertCompactRegistryMedia`で検証し、`dist/_publication-media.json`を毎回生成する。権利許可、正規の保護来歴、canonical sourceと公開・保護object集合の一致が必要。draft・holdは対象外。未確認の素材を一覧へ手書きして公開する入口ではない。

生成物はsource SHAと公開URL・SHA-256・bytesだけの小さなprojectionであり、新しいprovider receiptや人間監査の証明ではない。非公開資料・会話・資格情報・原本・完全なreceiptは含まない。`ci:final`で正規入力から再計算した結果とbytes比較し、改変や古いprojectionを拒否する。

配信側は、既存の成功main run・固定Production artifactのdigest・正規handoff検証を通した後、その成果物内のprojectionだけを読む。source SHA一致、厳密なキー集合、件数・サイズ・重複、固定`https://assets.xpotato.net`とcontent-addressed URLを検査する。その集合にあるliteralなimg/source URLだけを追加で受け入れる。query、hash、別origin、userinfo、相対・正規化alias、未登録画像は拒否し、CSS画像・旧ホーム写真・ローカルUI資産の既存検査は維持する。

projectionのない旧成果物は、従来のローカル画像だけなら扱える。R2参照があれば拒否する。通常buildや配信前の一覧照合はR2資格情報を使わず、保存・公開画像の実bytes照合を代替しない。保存CIの真正な検証結果と、配信後の公開URL・画像確認は別工程として必要。

初回記事では32objectを生成する。512object・1object24MiB・manifest256KiBの上限超過は明示的な停止とし、黙って対象を省かない。この変更で配信の自動起動や認証・権限・保護設定を追加しない。
