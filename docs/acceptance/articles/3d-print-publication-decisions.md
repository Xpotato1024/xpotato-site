# 3Dプリンタ記事：根拠・権利・公開前の判断

これはPR123から継続する記事の非公開準備記録です。PR123の基盤はmerge・配信済みですが、この記事は未公開です。正式Article Job、内容／画像のhuman approval、保存receipt、公開承認ではありません。対象ContentIdは `e7562440-e0bf-42a9-8a90-d66f4e1a4eb8`、現行原稿は `tests/fixtures/article-concrete/article.mdx`、MDX SHA-256は `cdb9a6c3b1e5ce1574f95dba78d98e21410bb408ac4136b99bbd1f492841a216` です。本文と図は保全し、2026-10-30の本人選択によりfixtureの主分類・タグだけを更新しました。主分類・タグ選択時のMDX SHA-256は4712b8ff24fcdf37838aa0ad136139e62912de899e2846cfa8c284b80bd8d9f6です。上のcdb9a6…は選択前の監査revisionです。

## 追加の権利修正とhero受渡し（2026-10-30）

本人依頼に従い、公式iconの複製図と末尾creditだけを除去しました。製品名見出し・設定名・8模式図を保持し、51 claimの文言は不変です。body span/hashを再対応し、現MDX SHA-256は `90fe669e994215f5ee20f6fc6329f4c4d857cdcafe9b320d4d59178c9bc69585`、bodyは `0f3c7d543181f3317428bcf1777506944c524f7e5c084a2c564d0e88bd80d57b`。research packetは `fd864c6475db3f2f9a9193e5951d0cc91c345b7cc0faea50b6f5022107436925` です。旧公式iconの許諾を確認済みに変更したのではなく、当該素材を利用集合から外しています。

既生成・本人採用のロゴ無しheroを正式Library経路で受領し、114,126 bytes／1200×675／SHA-256 `856bfb5ee390e11acad15167de423adc93a2b014d9f5b6404780a2de4480f9a0` と目視を照合しました。親側で確認した生成・採用履歴とLibrary identityは私有記録へ保持。旧icon合成版のhash/generation identityを新JPEGへ転用しません。仮表紙の既存manifestも保全し、新素材のprivate previewを別生成しました。画像bytesはGitへ追加しません。

正式Article Job、内容／visual監査、本人のexact candidate承認、実保存・保護は未成立です。実装済み経路・接続確認・必要差分は[実行経路の確認](../../operations/article-runtime-readiness-20261030.md)を参照してください。以下には修正前の調査・選択履歴も残しています。

## 根拠の記録と限界

[機械検査用の研究記録](3d-print-strength-research.json)は、既存SourceRecord／EvidenceRecord／ArticleClaimRecordのschemaを使い、22資料、23根拠、51本文箇所をhashで対応づけます。一次資料14件と、repository内の模式図8件を含みます。source snapshotは匿名GET／GitHub読取で取得し、実SHA-256とGit blob SHAを確認しました。外部資料の全文とicon bytesは私有 `.local` だけに保持し、Gitに転載しません。Gitに残すのは安全なmetadata、原稿の主張、短い日本語要約とhashです。

SourceRecordの今後のArticle Job外部送信admissionはdenyのままです。今回の本人依頼による読取調査を、外部provider stageの実行・human著者／監査者・正式job stateへ偽装しません。現行local review schemaのscopeは `human_local`／`synthetic_fixture`、reviewerはhuman限定です。このagent研究記録をそのどちらかへ偽装してimportしません。正式jobへの受入れと独立内容監査は別工程です。

大きいHTML／codeとPDFのraw bytesも保存しましたが、現行local-source-bundleの文字snapshot上限262,144文字へそのままimportできる形ではありません。正式intakeでは決定的な本文抽出・範囲・元snapshotとのhash lineageを作り、新しいSourceRefへ結び直す必要があります。現行raw取得やschema検査を、正式intake／external-provider activationの完了とは扱いません。

| 根拠 | 原稿との対応 | 確認範囲 |
| --- | --- | --- |
| s0001–s0003：Prusa Infill／Layers and perimeters／Modeling | 外周・充填・上面支持・造形方向・試作 | 公式説明の要約。全形状の強度順位や実印刷の原因判定ではない |
| s0004–s0007：Bambu／Curaの固定設定定義と日本語PO | 設定名、Strength分類、上面層数と厚さ下限 | 原稿のcommitへ固定。最新版GUIを実操作したとは扱わない |
| s0008：Cura Infill settings | 充填線の間隔、材料消費、上面支持、線と壁の接続 | 同じ線幅・パターン等の条件を持つ説明。任意パターンの定量性能へ一般化しない |
| s0009：MIT Stresses in Beams | 根元の断面と表面層の曲げに関する推論の補強 | p.4の式(5)–(7)。線形弾性・単純梁の傾向で、FDM板の破壊荷重や変位を計算していない |
| s0014：PrusaSlicer 2.9 First print | スライス後のPreviewで層sliderを動かす操作 | 公式の操作説明を追加。各ソフトのUI位置の一致や、この記事のモデルを実スライスした証明ではない |
| s0020–s0027：元SVG | 外形・荷重・壁数・上面層数・支持間隔の比較 | repository-nativeの説明図。実測・シミュレーション・実UIではない |

外周2／4周、充填15／30%、0.2mm×3／5層は説明用の条件です。図の格子面積を15／30%の精密な実装と扱いません。薄い上面の曲げ、層方向を変えたフックの比較、通常のモデル内充填とCAD寸法の区別は、明示した前提での推論／提案として記録しました。破面だけから原因を特定したり、材料量が異なる条件から強度効率を算出したりしていません。

既存の[1]–[5]を固定Source IDへ対応させ、既存コンパイラで標準Markdown脚注の**私有変換案**を生成できます。元原稿の出典節は保全します。変換案は屋根の曲げ推論の文の直後にMITの脚注を挿入します。この変換案自体は未採用です。脚注のコンパイル成功だけで主張の妥当性や正式jobをPASSにしません。

`npm run article:research:check` はGit上の記録・本文span・参照整合と引用変換を検査します。私有取得証拠がある環境では `-- --snapshots --citation-preview` を付け、元bytes／Git blobも照合して私有脚注案を保存できます。CIは外部資料を再取得せず、私有snapshotがないことを実bytes検証済みと報告しません。

## 図版の由来と掲載権利

- 8パネルは `f632a7be554c116cf06809bad64f63d0510fa467` と後続の `9e27729a46e67978fcb0314e0712c68b48dd00f9` のrepository-native SVGから追跡できます。外部の実験写真や公式UIを生成で模写したものではなく、本文の仮定を表す幾何図です。AI補助の有無をGit author名から推定してhuman作品と断定しません。公開候補では原稿との整合・視覚監査・本人media承認が必要です。
- Bambu iconは固定Git blob `d269a08743154a7dd67238ff51a5e44404a48a2f`、Cura iconは `9c98035c6b69d221ee99ca0a86a24bb37f413c6f` と照合済みです。公式由来の確認であり、掲載権利のadmissionではありません。
- 同じ固定版のroot LICENSEはBambuがAGPLv3、CuraがLGPLv3です。この事実だけで、iconの単独加工・記事掲載と商標条件をすべて満たすとは判断しません。Curaの[Terms of use](https://ultimaker.com/legal/terms-of-use/) 9.1も確認しましたが、Git上のiconに対する個別許諾を得た記録ではありません。
- Bambuのprogram agreementは検索結果だけで本文未確認（取得HTTP 402）。別programの規約をこの記事のicon許諾へ流用しません。未確認のままです。フォーラム投稿や第三者の法律説明を許諾根拠にしません。
- Bambuのpreview wikiも本文取得HTTP 402だったため、同URLを再試行せず、操作根拠には取得できたPrusa公式資料を用いました。

**採用したローカル置換案**：設定名節の `Figure asset="slicers"` 1個を外し、既存の製品名見出しと設定名リストを残します。末尾のicon引用文も外します。新しいブランド風図案や生成UIを作らず、主論点の8模式図は保持します。[安全な置換案](3d-print-icon-free-proposal.json)は元の本文hashへ固定し、上記追加準備で適用しました。iconを使わない新しい本文・media集合と根拠対応を再検証します。正式候補や監査の成立を自動的に意味しません。

## 2026-10-30の本人選択と残る判断

| 項目 | 現在の根拠 | 提案・残判断 |
| --- | --- | --- |
| ContentId・原稿title | PR121由来のfixtureと後続の最小修正 | 同一記事として保持。title／SEO／カード改行の役割は分離 |
| SNSカード | 本人がCを採用済み | C標準を保持。category label確定後に画像と候補hashを更新 |
| slug | `/blog/article-infill-concrete/` はprivate previewの仮route。公開記事なし | 先のslug案 `fdm-strength-settings` は履歴として保全。後続の本人承認でContentId全bitの自動URLを採用し、予定URLは `/articles/77arj41r5z8amrn46pdx71mknr/`。fixtureの旧仮routeへのredirectは作成しない |
| 主分類 | 現行 `robotics` は仮値。「ロボットと制御」という既存説明とは記事の主題がずれる | 本人選択：`making`「工作」→`3d-printing`「3Dプリンタ」。編集用registryへ追加し、fixtureだけに適用。既存記事の主分類は保持 |
| 関連タグ | `tags: []` はfixture値。既存registryに当記事向けの確定語なし | 技術タグ `fdm`（FDM/FFF）と目的タグ `design`（設計）・既存ID `troubleshooting` を採用。形状／設定選択と破損状態の見直しに対応。製品／実測／review／tutorialタグは増やさない |
| 公開日 | fixtureの2026-10-28は公開の証拠ではない | **未定**。実際の公開日／公開予定が承認された時点で公開用metadataへ設定。現在日付を公開日として捏造しない |
| hero | 追加準備で生成・採用履歴を確認し、上記ロゴ無しJPEGの正式受渡しとbytesを照合 | 新しい素材記録と描画検証へ進む。旧合成画像や仮枠のidentityを転用しない。正式visual audit／候補承認は別 |

主分類・タグは本人選択を反映した実装候補です。凍結済みmigration dataと既存記事の所属を保持し、44記事の移行はしていません。目的タグは語の重複を避け、既存troubleshooting IDとURLを継承しました。今回Personal Contextの参照は利用不可だったため、見えていない過去合意でheroや日付を補完していません。URLの追加質問は[Articlesと自動発行の不変URL](../../design/article-url-identity-20261030.md)で比較し、後続の本人承認を[ADR-0059](../../design/adr/0059-immutable-article-url.md)へ記録しました。PR123で実装・検証し、merge・記事公開・deployは別工程です。

## 選択metadataのローカル検証（2026-10-30）

- 対象の本文hashは不変。MDX全体はfrontmatterの主分類／タグだけを変更し、`4712b8ff24fcdf37838aa0ad136139e62912de899e2846cfa8c284b80bd8d9f6`。22 source／23 evidence／51 claimと私有取得bytesを再照合し、research packetは`f42763c7083366cd3b04df2009d36e3d19a87fb447446111d2b74091d9f73890`、引用変換hashは従前のまま。正式Article Jobの成立を意味しない。
- 実Blogテンプレートの隔離合成projectionは33ページを生成。Edge 155.0.4283.62で18条件（1440／390／320px、選択metadataの詳細ページは文字100／200%）のパンくず／JSON-LD一致、技術・目的タグの分離、archive link、横はみ出しなし、WCAG 2 A/AA・2.1 AA自動検査の違反0を確認。合成公開projectionは実記事の公開証跡ではない。
- 3D記事の私有composition previewは6条件でPASS。Cカード1200×630の分類名を「3Dプリンタ」へ更新し、PNG hashは`25b61643b31f03ebd25a259954de7463aa9b22ff1cff8aa68b8d07ffb966fc6a`。見出し・意味単位改行・Cの構成を保持。heroは引き続き未採用の空slot、noindex、productionEligible=false。
- 通常distは21ページ・検索10件を生成。対象ContentId・仮route・新C画像hashがHTML/XML/JSON等に存在しないこと、公開記事がないmaking／fdmの空archiveを生成しないことを確認。通常build・repository/static検査とCSS予算検査はPASS。Prime CSSはローカルでraw94,008／gzip18,661 bytes（上限100,000／32,000）。CIのclean build実測とは区別する。
- 関連34試験はPASS。Astro checkはerror 0、既存のPrime型宣言・検索keyCodeのhint 2件。独立静的レビューの今回差分はP0/P1/P2=0/0/0。実機モバイル・Firefox/WebKitの追加検証は未実施。
- metadata preflightは`BLOCKED_PUBLICATION`のまま。選択slug／分類／タグの一致はPASSだが、公開日・正式job／出典intake・hero／権利・実source/public/protected保存・compact export・本人候補承認は未完了。mock成功やこのローカルQAで置き換えない。

## Server接続と操作・権限の境界

authorityはSiteが固定するServer `ab9328c5a58082ac1ec268aa7d5901d838a6a474` の[architecture](https://github.com/Xpotato1024/Xpotato-Server/blob/ab9328c5a58082ac1ec268aa7d5901d838a6a474/docs/architecture/website-cloudflare.md)／[A/C作成手順](https://github.com/Xpotato1024/Xpotato-Server/blob/ab9328c5a58082ac1ec268aa7d5901d838a6a474/docs/operations/website-r2-ac-creation.md)。既存GitHub読取で文書は取得済みです。利用可能な接続にはA/B/Cを読む認証済みCloudflare sessionがなく、新規credentialの取得や設定は行いません。Worker向けreadonly接続があってもR2の権限へ拡張しません。

| 工程・対象 | 必要な条件／権限 | 今回の状態 |
| --- | --- | --- |
| A/B/Cのfresh preflight | operator所有の既存readonly session。account/zone、jurisdictionごとの全bucket pagination、privacy/domains/lifecycle/lock、B namespace、Worker bindings=0 | 未接続。403/timeout/未完paginationを不存在としない |
| A/C creation（不存在が確認された場合のみ） | 別のA/C-Create認可。account範囲Workers R2 Storage Write。既存B等にも及ぶ広い能力と残余リスクをreview | 未実施。通常Site writerへ渡さない。作成とlockを一括認可にしない |
| C whole-bucket Indefinite Lock | Cへの別認可。expiryなし／public endpointなし。retention短縮・unlockを復旧手段にしない | 未実施／現況未確認 |
| 署名session | A/B/C別のsigning parentをoperatorだけが管理。parentはObject Read & WriteでDelete等も持ち得るためjob／CIへ渡さない | 未取得。Siteがlocator／parentの第二SoTを持たない |
| source A保存 | approved exact keyだけの15分S3 child、GetObject/HeadObject/PutObject。本人候補承認とsource保存認可 | 未実施。conditional create、既存時はSHA/size照合、異なるbytesは停止 |
| public B保存 | 同様にexact public delivery keyの別childと公開upload認可。画像bytesの外部公開を伴う | 未実施。記事deploy前でも画像自体は公開されるため別判断 |
| protected C保存 | C writerと別B readerのchild。bounded GET→PUT、lock/policy/実bytes照合 | 未実施。single childのcross-bucket copyやlock errorの成功扱いは禁止 |
| Site live adapter/journal接続 | Serverの上記resource/capability sessionとoperation admissionが必要。現在のGET専用transportだけで保存laneは完成しない | 未完了。mock journalやfixture receiptを実運用へ転用しない |
| compact exportと記事公開 | 実source/public/protected証跡、独立内容／画像監査、本人候補承認、通常PR、exact main Production artifactと別のmanual deploy認可 | 未実施。記事はcanonical未登録のfixture |

この調査はcredential取得・token発行・provider設定・storage書込・Ready・merge・deployを行いません。接続未成立は確認済みの制限であり、providerから操作を拒否されたという報告ではありません。
