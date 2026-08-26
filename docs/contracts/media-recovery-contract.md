---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - published content media recovery requirements
  - exact media restore semantics
---

# Media Recovery Contract

## Purpose

R2-firstによりGitはphotographic/raster media bytesを保持しない。

Media RegistryはSHA-256 / object key等のidentityを保持するが、Gitだけでは失われたobject bytesを復元できない。

この文書は**published mediaが欠損・破損した後のrecovery requirement / restore semantics**を定義する。

publication時のprotected-copy作成、hard gate、receipt schemaは`published-media-protection-contract.md`を正とし、この文書へ重複定義しない。

## Principle

public R2 mediaはdelivery copy / active published objectであり、唯一のrecovery authorityにしない。

published mediaは、public delivery namespaceとは別のprotected recovery sourceからexact bytesを復元できる必要がある。

content-addressed keyはoverwrite事故を防ぐがdelete/provider/account/operator failureのbackupではない。

## Recovery identity

Media Registry / MediaPublicationManifestが持つ:

- SHA-256
- size
- format / content type
- immutable object key

をrecovery verification identityとする。

restoreはsemantic assetを「似た画像」へ差し替えるのではなく、expected published bytesを復旧するoperation。

## Protection relationship

new Article Job publicationは:

```text
HUMAN_APPROVED
 -> MEDIA_PUBLISHED
 -> MEDIA_PROTECTED
 -> EXPORTED
```

を正とする。

`MEDIA_PROTECTED`のexact receipt / object-set bindingは`published-media-protection-contract.md`。

この文書はそのreceiptが指すrecovery sourceを実際に利用してrestoreできることを要求する。

## Recovery backend requirements

infrastructure ownerは少なくとも:

- public `xpotato-assets` delivery namespaceとは別のprotection policy
- accidental delete/overwriteへのdestruction resistance
- expected object hash/sizeを検証できるrestore path
- public delivery credentialとrecovery credentialの分離
- periodic protection/integrity validation
- representative restore drill

を提供する。

same provider/account内locked copyはdestruction resistanceには有効だがprovider/account failure independenceとは別class。

initial vNextはsame-provider destruction-resistant protected copyをlaunch requirementとし、provider-independent second copyはinfra-wide future DR decisionとする。

## Recovery procedure

public object missing/corrupt時:

1. Git Media Registry / Publication Provenanceからexpected object identityを取得
2. corresponding media protection receiptを確認
3. infra recovery systemへexact protected object identityを要求
4. private recovery stagingへbytesをrestore
5. SHA-256 / size / media typeをverify
6. expected content-addressed public R2 keyへpublish/reuse
7. public object identity / availabilityをverify
8. site render/smokeを確認
9. repair / incident recordを残す

Git content rewriteでbroken mediaを別画像へ勝手に差し替えることをrecoveryと呼ばない。

## Raw source relationship

private iPhone original / screenshot sourceが保持されていても、それだけをpublished Web masterのexact recovery authorityとみなさない。

理由:

- normalization profile/tool versionが必要
- crop/editが存在し得る
- AI-generated public masterはsame raw inputからsame bytesを再生成できない場合がある

raw archiveはvaluable secondary sourceだが、exact published-object protectionとは別class。

## AI-generated media

AI-generated raw outputをlong-term保持する場合も、public normalized masterのexact recovery requirementは別に維持する。

providerへsame promptを再送してsame bytesを再生成できるとは仮定しない。

## Migration

legacy mediaをGitからR2-firstへ移した後、old Git/raster copyをactive treeから削除する前に:

- public R2 object verified
- protection receipt coverage complete
- representative protected-copy restore verified
- restored SHA-256一致

を要求する。

bulk migrationはArticle Job per-article approvalではなくmigration operator authorizationを使えるが、recovery requirementは同じ。

## Ownership

### xpotato-site

owns:

- expected object identity semantics
- Media Registry / provenance linkage
- protection receipt verification requirement
- broken-object detection
- restore success acceptance criteria

### Xpotato-Server

owns:

- backup/protection backend
- provider resource configuration
- credential scope / separation
- retention / lock / lifecycle
- restore implementation
- recovery drill / freshness validation

provider ID / backup bucket name / secret locatorをsite repoへcanonical duplicateしない。

## Validation

site-side:

- active registry object has expected identity
- current provenance has publication/protection lineage
- missing/corrupt public object detection

infra-side:

- protection receipt maps to recoverable protected bytes
- protected policy freshness valid
- expected non-admin credential cannot unintentionally delete protected copy
- representative exact restore succeeds

cross-repo migration/release reviewで両方を確認する。
