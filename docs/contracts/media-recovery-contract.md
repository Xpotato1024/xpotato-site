---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - published content media recovery requirements
  - site-to-infrastructure media protection contract
---

# Media Recovery Contract

## Problem

R2-firstによりGitはcontent media bytesを保持しない。

Media RegistryはSHA-256 / object keyを保持するが、Gitだけでは失われたobject bytesを復元できない。

content-addressed keyはoverwrite事故を防ぐがdelete/provider-lossのbackupではない。

## Principle

public R2 mediaは**delivery copy / active published object**であり、唯一のrecovery authorityにしない。

active published mediaは、public media namespaceとは別のprotected recovery sourceからexact bytesを復元できることをtargetとする。

## Recovery identity

Media Registry / MediaPublicationManifestが持つ:

- SHA-256
- size
- format/content type
- immutable object key

をrecovery verification identityとする。

restore後はsame content-addressed object keyへexact bytesを戻せる。

## Protected recovery requirement

published media protection backendはsite repoが選択/実装しない。

infrastructure ownerは少なくとも:

- public `xpotato-assets` namespaceとは別のfailure boundary / protection policy
- accidental delete/overwriteへの保護
- object hash/sizeを検証できるrestore path
- credential separation
- periodic recovery verification

を提供する。

same provider/account内のlocked protected copyはdestruction resistanceには有効だが、provider/account failure independenceとは別要件として扱う。

## MediaProtectionReceipt

site-side workflowがprotection stateを確認するため、provider-neutral receiptを受け取れる。

```ts
interface MediaProtectionReceipt {
  schemaVersion: 1;
  publicObjectSha256: string;
  publicObjectKey: string;
  protectionClass: string;
  protectedAt: string;
  verifiedAt: string;
  recoveryIdentity: string;
}
```

`recoveryIdentity`はsecret locator / credentialを含まないopaque identity。

receiptをGit Media Registryへ必須複製する必要はない。backup/recovery stateのSoTはinfrastructure側。

## Publication versus protection timing

Article Job normal publication:

```text
HUMAN_APPROVED
 -> MEDIA_PUBLISHED
 -> EXPORTED
```

を維持できる。

ただしpublished mediaはmachine-readable protection RPO内にrecovery protectionへ入る必要がある。

exact RPO / whether protection should become a pre-export hard gateは`design/open-decisions.md`で決める。

**protectionが未確認のobjectをgarbage collection / source deletionの根拠にしない。**

## Migration gate

legacy media移行では、old repository/public copyを削除する前に:

- R2 public object verified
- recovery protection path configured
- representative restore verified

を要求する。

bulk migrationはArticle Job per-article approvalではなくmigration operator authorizationを使えるが、recovery requirementは同じ。

## Raw source relationship

private iPhone original / screenshot sourceが保持されていても、それだけをpublished Web masterのexact backupとみなさない。

理由:

- normalization profile/tool versionが必要
- crop/editが存在し得る
- AI-generated public masterはsame raw inputから再生成不能な場合がある

raw archiveはvaluable secondary recovery sourceだが、exact published object protectionとは別class。

## AI-generated media

AI-generated raw outputをlong-term保持する場合も、public normalized masterのexact recovery requirementは別に維持する。

providerへ同promptを再送してsame bytesを再生成できるとは仮定しない。

## Recovery procedure contract

public object missing/corrupt時:

1. Media Registryからexpected SHA/key/sizeを取得
2. infrastructure recovery systemへexact object identityを要求
3. private stagingへrestore
4. SHA/size/content typeをverify
5. expected content-addressed R2 keyへpublish
6. public fetch / hash or equivalent verification
7. incident / repair recordを残す

Git content rewriteでbroken mediaを別画像へ勝手に差し替えることをrecoveryと呼ばない。

## Ownership

### xpotato-site

owns:

- object identity semantics
- expected SHA / key
- published media registry
- recovery requirement
- site-side broken-object detection

### Xpotato-Server

owns:

- backup/protection backend
- bucket/resource configuration
- object credential scope
- retention / lock / lifecycle
- restore operation
- recovery drill

provider ID / backup bucket nameをsite repoへcanonical duplicateしない。

## Validation

site:

- active registry object resolves public object
- expected hash/size known
- missing object detection

infrastructure:

- protection freshness within policy
- exact object restore succeeds
- protected object cannot be unintentionally deleted under expected credential boundary

cross-repo release/cutover reviewで両方を確認する。
