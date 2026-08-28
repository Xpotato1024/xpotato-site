# Clean-room Phase-gate Audit #1 — 2026-08-26

Status: Historical audit report / non-authoritative

## Audited revisions

- `Xpotato1024/xpotato-site`: `567c9082494579a1d0b3663eb31a96003b7d05cd`
- `Xpotato1024/Xpotato-Server`: `20da6a8c025ff4cf51db19974813f00ec83d6210`

The audit pass was read-only. Findings below were frozen before any remediation write。

## Verdict

**FAIL — P0=0 / P1=13 / P2=1**

## Findings

### A1 — P1 — site自身にphase-gate governanceがない

Failure mode: site revisionだけからclean-room source boundary、severity、audit/remediation separation、Design Freeze lifecycleを一意に復元できない。

Done: site-local audit/severity/design-status SoTを追加しAGENTS/SoT Mapから到達可能にする。

### A2 — P1 — cross-repository dependencyがmutable branch参照

Failure mode: same site revisionから将来別のinfra designを読める。

Done: repo + exact counterpart commit SHA + ADR/statusをcanonical handoffへ固定する。

### A3 — P1 — infra global FROZEN statusとwebsite proposal activationが曖昧

Failure mode: ADR-0024はProposedなのにwebsite exact valuesがactive `inventory/desired`へ存在し、clean-roomでcurrent desired stateかcandidateか判別不能。

Done: website sub-gateを明示し、proposalの間exact website valuesをactive desired stateから外す。

### A4 — P1 — ADR-0005 Node boundary drift

Failure mode: ADRはNodeをbuild-onlyとするがcurrent architectureはbuild + authoring toolchainとする。

Done: public runtimeにNodeを置かないdecisionへ修正する。

### A5 — P1 — ADR-0008 media architecture drift

Failure mode: typical imageを`src/assets/content`へ置く旧decisionがR2-first/current pipelineと矛盾。

Done: private canonical ingest + R2-first + prebuilt variantsへ修正する。

### A6 — P1 — ADR-0014 delivery preference drift

Failure mode: Cloudflare Images preferred / prebuilt fallbackがcurrent baselineと逆。

Done: deterministic prebuilt variants baseline、provider transform optionalへ修正する。

### A7 — P1 — ADR-0015 publication sequence drift

Failure mode: `HUMAN_APPROVED -> MEDIA_PUBLISHED -> EXPORTED`でsource storage/protection gateを欠く。

Done: exact current persistence sequenceへ同期する。

### A8 — P1 — ADR-0018 recovery sequence drift

Failure mode: protected-public-byte decisionがmandatory source-storage stateを含まない。

Done: current state chainへ同期しscopeをpublic exact-byte recoveryに限定する。

### A9 — P1 — ADR-0019 R2 admin trust boundary不足

Failure mode: Git-driven/Dashboard-freeを記述するが、R2 config adminをpersistent CP/site CIへ置かないADR-0020 boundaryを十分に表現しない。

Done: desired stateとmutation capabilityを分離しoperator-ephemeral adminを明示する。

### A10 — P1 — invalid state name `MEDIA_VARIANTS_READY`

Failure mode: private canonical storage contractだけがstate machineに存在しない名前を使用。

Done: `MEDIA_READY`へ統一し全文検索で残存ゼロ。

### A11 — P1 — cleanup後にmaterial claim -> evidence mappingが失われる

Failure mode: Product Contextはmaterial claimのsource/evidence traceabilityを要求するが、Git provenanceはbundle hash + source refsだけで、workspace cleanup後にclaim/evidence bindingを復元不能。

Done: public-safe compact material-claim evidence ledgerをdurable Git provenanceへ保存する。

### A12 — P1 — cleanup後にmedia recovery bindingが失われる

Failure mode: recovery contractはMediaProtectionReceiptのprotected object refを必要とするが、Gitはreceipt hashだけ。workspace cleanup後にrestore locatorを復元できない。

Done: exact receiptからsecret-free compact recovery bindingをGit provenanceへexport/validateする。

### A13 — P1 — stable ContentIdのmaterial ADR欠落

Failure mode: route/media/provenance/update全体のidentity basisであるUUIDv4 decisionのalternatives/rationale/replacement ruleがADRにない。

Done: dedicated ADRを追加する。

### A14 — P1 — full Article Job retention / compact durable lineageのmaterial ADR欠落

Failure mode: private full artifactsを削除するprivacy/storage trade-offとdurable audit dataの境界がpolicyだけで、decision historyがない。

Done: ephemeral workspace + durable compact claim/recovery/provenance ledgerのADRを追加する。

> Counting note: A11/A12 are one traceability/recovery durability cluster in the phase-gate count, while A13/A14 are two missing-ADR blockers. Total phase-gate P1 count = 13 as frozen during the audit pass.

### A15 — P2 — Pagefind ADR lifecycle wording

Failure mode: never-accepted Pagefind proposal is marked `superseded` by another still-Proposed ADR, which overstates lifecycle history。

Done: mark original proposal `rejected` and replacement as proposed until acceptance。

## Remediation rule

This report itself does not change architecture. Remediation must occur in a separate pass, followed by a fresh clean-room audit against new exact revisions。
