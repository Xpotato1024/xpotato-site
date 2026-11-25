---
status: proposed
owner: architecture
last_verified: 2026-11-26
---

# ADR-0093: 下書きの再開先を固定し、AI原稿と私有画像を同じ制作単位で引き継ぐ

## 背景

Xpotato Siteのプロダクト記事をAIが改稿した際、MDXが参照する図版は本人限定Sitesで表示できたものの、CMSのDraft媒体領域へ登録されておらず、CMSでは「画像未登録」と表示された。また、「下書きの続き」でAI原稿のブランチを読み込んだ後に、別の既存ブランチを作業先として選べた。選択元と保存先を別々に決める操作は、新規作成・公開原稿の改稿には必要だが、下書きの継続では本文・画像・添削の組を取り違える原因になる。

ADR-0079のMDXを正本とする公開Git下書き、所有者限定Draft R2、公開A/B/Cとの分離を維持し、再開と媒体引継ぎの同一性を具体化する。

## 判断

### 1. 下書きの継続は元の作業ブランチへ固定する

Git原稿を選んだ一覧のsnapshotを、その原稿を開く処理まで保持する。「添削から開く」でも同じ`content/*`ブランチを使い、別branch・新branch・端末への切替を継続操作に混ぜない。古い一覧や遅れて返った応答による取り違えを拒否し、UI以外の読込処理でも同じ制約を守る。

すでに作業branchがある端末下書きは、オフラインでもbranch・baseCommit・未保存入力を保持する。新規作成、Git未接続の端末下書き、公開記事改稿の作業先選択は残す。公開記事の改稿先に同じpathの別本文がある場合は、勝手に置換・採用せず拒否する。

### 2. AIの図版は、固定原稿へ結び付けた私有ファイルから登録する

AI側のCLIは、固定Git本文と同じContentId・branch・commit・path・本文hash、本文が参照するassetId、正規化済み画像bytes/hashを一式にする。準備だけでR2保存済みとはしない。用途別の変換は既存媒体処理を使い、記事ごとに別encoderや上限を設けない。

認証済みCMSがファイルを受け取り、元のassetIdを保って既存Draft APIへ登録する。所有者session・CSRF、容量予約、revision照合、アップロード後の実bytes取得を通す。AIが利用可能な接続済みブラウザーを持つ場合も同じ操作を行う。長期token、Cookieの抽出、直接R2書込み、A/B/Cへの権限は追加しない。

### 3. 再実行と競合を区別する

同じassetId・hashは実bytesを照合して再利用する。異hashへの差替えには取得済み旧hashを要求し、別端末の更新や端末の未同期変更を黙って上書きしない。途中の成功は保持し、再実行で残りを進める。原稿・Git head・参照画像の一式がそろうまで登録完了を示さない。

Draft recordはContentId・branch・sourcePathの組で再利用し、複数端末の作成をCAS内で一つへ収束させる。既存recordの曖昧さを自動統合しない。復元時も同じ組を照合する。recordのcommitはGit activityで変化するため、復元ではlocalのbaseCommitとの一致を強制しない。固定原稿の一致は画像bundle登録とAstroレビューがそれぞれ持つ。

## 比較した代替案

| 方法 | 判断 |
| --- | --- |
| 任意の作業branchを残し、利用者に同じ名前を選んでもらう | 下書き再開のたびに取り違えが起こり得るため採用しない。 |
| 図版をGitへ追加する、または公開R2へ先に置く | Draftの私有媒体と公開媒体の境界を失うため採用しない。 |
| AI用の長期token・直接R2 uploaderを新設する | 現在の所有者認証と予約・競合・保存確認を別経路に分けるため、この変更では採用しない。 |
| 一枚ずつCMSへ読み込み、新しいassetIdへ本文を書き換える | 手作業と参照の書換えを増やすため、一括引継ぎでは元のassetIdを保持する。 |
| 画像がないまま本文の表示やSites更新を完了とする | CMSで添削できる一式を受け渡したことにならないため採用しない。 |

## 所有する契約と受入れ

開始画面・同一性・競合の契約は[CMS編集画面](../../contracts/cms-workbench-contract.md)、実行手順は[CMS制作手順](../../operations/editor-workflow.md)、制作の終了条件は[一貫制作](../../operations/content-production.md)が所有する。準備CLIとCMSは`packages/editor-core/src/media-handoff.ts`を共有する。既存Jobを置き換える状態機械や承認台帳は設けない。

回帰検証は、別branch・古いsnapshot・異なる本文の拒否、MDX参照の完全性、画像hashの検査、同時Draft作成、同一bytesの再実行、競合・途中失敗と再開を対象にする。実ブラウザー操作、実GitHub App認証、実Draft R2への保存・復元、iPhone実機、本番配信はそれぞれ別の証拠である。対象revisionと結果は対応PRに集約する。

このADRは変更候補を記録する。main採用、Ready for Review、merge、provider変更、記事の正式公開、本番配信の認可・完了を表さない。
