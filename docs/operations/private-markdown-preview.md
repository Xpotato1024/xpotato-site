---
status: canonical
owner: operations
last_verified: 2026-10-15
canonical_for:
  - private handwritten Markdown draft CLI
---

# 手書きMarkdownの非公開下書きpreview

採用済み記事設計のA2「書いて確認する」入口です。Blogの新規作成・既存ContentId更新・保存/再開・手書き取込み・guide・draft検証・localhost previewを実装します。正式候補、独立監査、画像、HUMAN_REVIEW_READY、承認、保存/exportの完成ではありません。AI/providerは不要で、これらのコマンドは通信しません。

## 最小手順

依存導入済みのrepository rootで実行します。Node/npmは既存toolchainに従います。初回の依存導入は別操作です。

```text
npm run site -- article taxonomy list --collection blog --json
npm run site -- article init --collection blog --title "記事タイトル" --description "記事の説明" --slug example-topic --category software --pub-date 2026-10-15 --reader-outcome "読者ができること" --authoring human --intent review --network disabled --json
npm run site -- article guide --job <実際に返されたjob-id> --json
npm run site -- article draft import --job <job-id> --from /absolute/path/draft.md --json
npm run site -- article validate --job <job-id> --level draft --json
npm run site -- article preview --job <job-id> --draft --json
```

initが返すworkingPathを普段のeditorで編集できます。外部編集の後は `article revise --job <id> --reason "本文を編集"` を実行します。importはfrontmatterなしの本文、または既存Blog契約に一致する完全なMarkdownを受け取ります。id変更、draft=false、未知taxonomy、余分なfrontmatter fieldは拒否します。slugはjob specに固定し、本文へslug fieldを追加しません。

previewが返す `http://127.0.0.1:<port>/` を開きます。portは既定で空きport、--portで明示できます。Ctrl+Cで停止します。--build-onlyは専用HTML/manifestを生成して終了します。任意output先やpublic bindの指定は提供しません。

全出力はJSONです。終了codeは0成功、2入力/検証不合格、3未実装stage/失効/運用gate、4環境/処理失敗。原文・secret・内部stackをerrorへ貼りません。guideは未実装、変更/未検証、検証不合格を区別します。

## 更新と権限

```text
npm run site -- article init --content-id <既存BlogのContentId> --update-kind correction --authoring human --intent review --network disabled --json
npm run site -- article init --from-job <review-job-id> --intent publish --network disabled --json
```

更新は同じContentId、既存route、base commit、元MDX bytes、全content registry source snapshotを固定します。originalのdraft値にかかわらずworkingはdraft=trueです。route変更はA2では提供しません。updatedDateは自動追加せず、著者が既存基準で判断します。旧44記事を選んでもcanonical contentやholdは変わりません。旧raw HTML等の本文はportable構文へ直すまでpreviewを拒否します。

review intentは既定で未指定permissionはfalse。--local-media-processingは将来のローカル画像処理の上限だけをtrueにします。publish intentは採用済み設計どおりlocal processing/private source/public delivery/protection/exportの将来上限をtrueにしますが、実操作・本人承認・provider gateを成立させません。networkは別指定、外部text/image AIは常にfalse。A2はpublish intentでも通信・画像保存・exportを実装しません。

A2のCREATED jobに対するreview→publishは新job/fingerprintを作り、古い承認を持ち越しません。旧jobのspec/permissionsを書換えません。

## 保存、lock、失効

既定rootはGit無視対象 `.local/article-jobs/`。spec/fingerprint、base snapshot、working.md、immutable attempt入力とhuman draft artifact、supersession記録、専用previewを保存します。--rootは既定rootの子またはrepository外のOS tempの子だけで、相対root・親指定・symlinkを拒否します。入力もregular UTF-8 Markdown/MDXに限定し、secret相当path/既知secret pattern、symlink、サイズ超過を拒否します。secret検出は一般的なpattern検査であり、任意の秘密の完全検出を保証しません。

job単位の排他lock、同一directory上のtemporary file＋sync＋renameで更新します。crashでworkingだけ変わっても旧attemptは失効し、旧承認へ戻りません。lockが残った場合は稼働processとjobを確認するまで停止します。自動lock解除・job削除・cleanupは行いません。同じ入力のimportは再利用、明示reviseは新attemptをCREATEDから作ります。

workingやrepository snapshotが違えばguideはcurrentState=nullと旧履歴を区別します。preview/validateは旧artifactを拒否し、配信中のpreviewも次のrequestから410を返します。新attemptは旧candidate/approval/media incidentを消しません。terminal jobは巻き戻さず新jobを要求します。source/evidence/auditの失効はA3手順で検証します。visualと正式candidateはA4以降で、実際の承認後再候補化は未実装です。A2は将来shapeの旧ready/approved attempt fixtureで失効境界を試験します。

## 表示と隔離

専用HTML adapterでMarkdown/GFMの表・脚注・コード・日本語を表示します。semantic moduleは簡易表示、画像/Demoは未準備表示。既存Astro公開layoutとの一致・SEO・画像の実物・正式候補のa11y/performanceはA4へ残ります。MDXをcompile/evaluateせず、任意import/export・JS式・spread・生HTML・危険URLをAST検証で拒否します。コード例をhostで実行せず、リンク先を自動取得しません。

127.0.0.1だけへbindし、Host/Originを検査、GET/HEADの / だけを配信します。job/source/manifestをHTTP公開しません。CSPはdefault-src none、script/image/font/connect禁止、CSSは生成hashだけ。no-store/noindex/no-referrerを付けます。localhost制限は同じOS利用者に対する認証や暗号化の代替ではありません。

通常siteはprivate jobを読みません。CIは人工private fixtureを置いてから既存buildを1回だけ実行し、catalog/feed/search/final distへcanary/ContentId/preview markerが入らないことを検査します。static validatorとrelease producerもprivate markerを拒否し、tracked private job pathをrepository validatorが拒否します。release packageは従来どおり検証済みdistとwrangler設定だけから作ります。実private資料・下書き・previewをPR/CI公開artifactへ添付しません。

## 実装範囲

実装済みA2: human draft/preview schema、job store、init/update/from-job、taxonomy、guide、import/revise、draft validate/preview、path/lock/atomic/失効、通常buildへの混入防止。

A3のsource/evidence/citations・正式DRAFTED・未実行コード例評価・独立human content audit・CONTENT_READYと非公開内容reviewは[別手順](local-content-review.md)を参照。後続A4–A7: hero/social/media・visual audit・完全candidate/preview、本人承認、保存/protection/export/cleanup、実記事公開。Tool固定release取り込みとready後通信ゼロ試験も別段階です。A2の成功を正式公開候補・執筆MVP全体・公開済みと表示しません。

A4の画像実物・決定的hero/social・完全候補previewは[画像と完全候補の手順](local-visual-candidate.md)へ接続しています。上記A2専用previewの簡易表示とは別コマンドで、本人承認・保存/exportは引き続き後続です。
