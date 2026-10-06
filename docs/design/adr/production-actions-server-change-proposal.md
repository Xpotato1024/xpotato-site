---
status: proposed
owner: operations
last_verified: 2026-10-06
---

# Server側変更案：サイト限定・期限付きtokenによる正式Actions配布

Serverへ適用していないレビュー資料です。対象はServer `c54a06ee377cae365af623b598ed852c4b577e1f` の `docs/decisions/ADR-0027-website-workstation-jit-deployment-exception.md` とwebsite architecture/current inventory。ServerでADR番号を採番し、別review/merge後にSite counterpart pinを切り替えます。現行authorityをこのSite提案で書き換えません。

2026-10-06、本人は比較案B（長期のサイト限定token保管）を明示選択しました。既存ADR0027の「GitHub secretを含む恒久deploy credential禁止」からの方針転換です。方式選択はcredential発行・保管・GitHub保護設定・workflow解除・本番deployの承認を含みません。

## 採用する条項の案

通常配布ownerはSite GitHub Actions、GitHub-hosted runner、pinned Wrangler。Cloudflare account-owned tokenはallow1件、`Individual Workers → xpotato-site → Editor`のみとし、追加policy/permission group=0。R2 API、DNS、Routes、redirect、API Tokens Write、他Worker、account-wide Workers Scripts Writeを与えません。既存selectorの名前だけを信用せず、個別Worker tagとresource map、live permission IDを独立readで照合します。

唯一の長期secret保管先はSite repositoryのEnvironment `site-production` の `CLOUDFLARE_SITE_API_TOKEN`。repository/organization Secrets、ローカル永続env、Wrangler login、`.env`、chat、CP/SOPS/Offline Kit、artifact/log/command lineへ複製しません。値は本人が安全なGitHub入力で一度登録し、AIが読み出しません。公開repoのPR jobにはEnvironmentもsecretも渡しません。

期限は発行から最大90日、60日で更新必須、残存7日未満もdeploy禁止。更新は本人承認付きで新tokenのexact policy/readbackを確認し、Environmentを更新後、旧IDをrevokeし、完全inventory不在とdetail404を確認します。token保管・更新は独立した認可で行い、永続minting issuerは作りません。期限予定やsecret上書きだけを旧token失効と呼びません。

正常operation後は同一tokenのactive状態とscope/期限の不変をreadbackし、毎回即revokeするJIT条項を正式B経路には適用しません。deploy failure・unknown・post-readback不一致・漏洩疑いの場合はSTOPし、事前に別認可済みの独立operator sessionで同ID emergency revoke/readbackとcontainmentを実施します。失効したEnvironment secretは使用不能のまま保持せず別認可で削除/更新します。自動復旧やrollbackを暗黙認可しません。

**残存risk**：Individual Worker EditorにはWorkerへのR2 binding導入が可能なdeploy能力が残り得ます。直接R2権限なしや403はbinding経由のhard isolationではありません。長期token漏洩ならGitHub保護を迂回してAPIへ直接到達し得ます。accepted config・provider前後のbindings=0、endpoint false、artifact同一性、保護されたworkflow、期限・更新・監査を防御として採用しますが、その限界を本人が承認する必要があります。漏洩時にGitHub Environmentを止めるだけではtokenは失効しません。

## 維持する境界

exact successful main run/attempt/artifact ID/API digest/source SHA、archive hash・既存Production staging/handoff、pinned toolchain、再buildなし、alternate configなしを維持。provider fresh preimage、100% traffic、bindings/routes=0、既存custom domain、workers.dev/Preview URLs=false、実version endpoint404/content不在、public byte一致を前後で確認します。独立containmentとrevoke能力を開始前に別認可・実証できなければ配布しません。単にWrangler exit0で完了しません。

R2/media/C-lock/DNS/redirect/publication/migration holdの別gateは維持。既存workstation JITはその独自の即revoke条件を変えず、正式B経路が少なくとも1回のlive acceptanceを通過してから別reviewで撤去します。正式B導入がJIT例外を自動で恒久化することもありません。

## 採用と実設定の順序

1. 本案とSite ADR0043のServer/Site両repoレビュー。現行ADRの禁止例外を正式に採用し、cross-repo pinを更新。
2. 本人が [設定案](../../operations/production-settings-proposal.json) と残存riskを明示承認。実際のmain保護・Environment設定をreadbackし、単独所有者の承認試験を行う。
3. token発行/保管/更新の具体operationを認可。scope/期限/IDの非秘密readback。独立containment・revokeを別認可し、非productionでactual adapter/supervisorを検証。
4. 保護情報・credential・providerのactual authenticated adapterと人間承認の証跡が揃った後、別reviewでworkflowを有効化。main artifact生成後、本人Environment承認でproduction operation。
5. live acceptance PASSを記録後、別Server/Site reviewed changeで暫定JITを撤去。

今回のPRは1の設計資料とoffline実装であり、2以降を実行していません。
