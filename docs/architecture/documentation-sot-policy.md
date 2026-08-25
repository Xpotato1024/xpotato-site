---
status: proposed
owner: architecture
last_verified: 2026-08-25
canonical_for:
  - documentation governance
---

# Documentation SoT Policy

## 目的

古い実装、古い runbook、現在の target design、decision history を混在させない。

## 唯一の current documentation root

vNext 採用後、`docs/` を唯一の current documentation root とする。

既存の `doc/` は legacy として扱う。新規文書を `doc/` に追加せず、vNext の current state を判断するときに `doc/` を canonical source としない。

root `README.md` は repository entrypoint に限定する。詳細な architecture や運用値を複製しない。

## 文書 role

- canonical architecture / policy: 現在採用している意味、責務、制約を記述する。
- ADR: 判断時点の context、alternatives、decision、consequences を保存する。accepted 後も書き換えて current SoT にしない。変更は新 ADR で supersede する。
- legacy: 移行元の事実と compatibility evidence。新設計の規範ではない。
- report / audit: 観測結果。policy を再定義しない。
- code / config: 実装事実。設計と不一致なら「コードが正しい」と自動判断せず drift として扱う。

## 1 topic = 1 canonical document

同じ規則を AGENTS.md、Skill、README、ADR、architecture doc に全文複製しない。

- AGENTS.md: 常時適用する短い規則と canonical doc / Skill への routing。
- Skill: 条件付きで再利用する workflow。
- canonical doc: 安定した仕様、理由づけ、boundary。
- CI / validator: 機械的に強制できる invariant。
- ADR: decision provenance。

## Metadata

canonical / proposed docs は原則として次を持つ。

```yaml
---
status: proposed | canonical | retired
owner: architecture | content | operations
last_verified: YYYY-MM-DD
canonical_for:
  - topic
---
```

`last_verified` は単なる編集日ではなく、内容を再確認した日とする。

## Drift handling

実装と canonical doc が食い違った場合、差分を隠すために文書を現状追認へ書き換えない。

1. 意図した target が文書側なら実装を修正する。
2. 設計変更が妥当なら ADR を作成し canonical doc を更新する。
3. 旧文書は必要なら legacy inventory に記録し、current doc へ混ぜない。

## Cross-repository SoT

`xpotato-site` はサイト application / content / build / route semantics を所有する。

Cloudflare account、zone、DNS、R2 resource inventory など共有 infrastructure の current / desired fact は `Xpotato1024/Xpotato-Server` を正とする。サイト repo はそれらの ID や provider state を第二の SoT として保持しない。
