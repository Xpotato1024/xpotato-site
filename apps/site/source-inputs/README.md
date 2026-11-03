# 配信しない保全入力

新サイトのbuild・媒体取込みが所有する既存Git画像の入力領域。media/catalog.jsonが9件の旧Git locator、新しいcontent-addressed path、SHA-256/size、既存ContentId・asset・権利記録との対応を定める。ホーム1件と媒体移行6件は現在の処理がここから読み、置換済み画面1件・未割当1件は再採用せず保全する。

ここは公開Git内であり、秘密・非公開資料を保存する場所ではない。新規の写真や記事画像を追加する通常入口でもない。9件以外のraster許可はなく、読取り時に注釈付き凍結tagの実blobと同bytesを検査する。追加、改変、欠損、symlink、旧rootへの複製は拒否する。

apps/site/publicへコピーしない。Astroの自動公開・asset収集の対象外であり、最終distへ原bytesまたはこのdirectoryが混入すると通常CIが失敗する。ホームは既存のprivacy normalization/variant生成を維持し、移行処理は採用済みのsource/rights/profileを維持する。

保全した原画像はprivacy-normalized canonical masterやR2保存・保護receiptの代わりではない。原画像の廃棄は実source/public/protected保存と復旧条件が成立してから別判断する。旧44記事のhold・URL履歴・公開cutoverは変更しない。

旧public locatorは固定Git上の来歴にだけ残し、現物の参照はこのcatalogで解決する。[配置と全9件の対応](../../../docs/operations/repository-ownership.md)を参照。
