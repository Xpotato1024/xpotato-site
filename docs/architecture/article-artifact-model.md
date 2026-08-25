---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job artifact and lineage model
---

# Article Artifact Model

## Principles

- source artifact は取得後 immutable
- derived artifact は input artifact へ遡れる
- semantic AI response と canonical artifact を分離する
- draft / audit / image candidate は versioned
- path は identity ではなく hash / artifact ID を identity とする
- final repository export は human-approved candidate からのみ生成する
- private reasoning は保存要件にしない

## Artifact classes

| Class | Examples | Canonical in job | Public repo |
|---|---|---:|---:|
| source | docs snapshot, GitHub ref, user notes | Yes | No |
| evidence | evidence records, ambiguity ledger | Yes | No |
| authoring | draft, claims, metadata proposal | Yes / versioned | No |
| audit | extracted claims, findings | Yes / versioned | No |
| visual plan | strategy, concept, restrictions | Yes / versioned | No |
| generated raw visual | exact provider output bytes | Yes / immutable | No by default |
| normalized visual | hero web master | Yes | Export selected derivative |
| candidate | MDX + metadata + assets package | Yes / versioned | After approval |
| preview | build manifest, screenshot refs | Regenerate / bind | No |
| approval | human approval ledger | Append-only | Compact record optional |
| definition | schemas, Skills, profiles | Repository SoT | Yes |

## Artifact envelope

すべての material derived artifact は少なくとも次を追跡する。

```json
{
  "artifact_id": "...",
  "artifact_type": "...",
  "content_sha256": "...",
  "size_bytes": 0,
  "relative_storage_path": "...",
  "input_artifact_ids": [],
  "producer": {
    "kind": "deterministic | semantic_ai | image_generator | human",
    "name": "...",
    "version": "..."
  },
  "configuration_sha256": "...",
  "created_at": "...",
  "warnings": []
}
```

AI artifact では additional lineage として:

- role
- provider / model / model snapshot where available
- Skill ID / content hash
- request fingerprint
- response schema fingerprint
- external API permission mode
- context / run identifier if provider exposes it

を保持する。

## Source record

source record は source の「存在」ではなく、article job がどの版を evidence としたかを表す。

例:

- GitHub: repository + commit SHA + path + blob hash
- official docs: canonical URL + retrieved time + snapshot / response hash where retained
- local note: source artifact hash
- local screenshot / photo: normalized evidence artifact hash

source content を public repo へ転載することは requirement にしない。

## Evidence record

```json
{
  "evidence_id": "E0001",
  "proposition": "...",
  "source_refs": ["S0003"],
  "class": "source_fact | user_observation | inference | recommendation | unknown",
  "confidence": "high | medium | low | not_available",
  "review_status": "unreviewed"
}
```

`inference` / `recommendation` を source fact として表現しない。

## Claim record

article draft の material claim は draft span と evidence へ bind できる構造を持つ。

```json
{
  "claim_id": "C0007",
  "text": "...",
  "draft_span": {"start": 120, "end": 184},
  "claim_type": "source_fact",
  "evidence_ids": ["E0001"]
}
```

auditor は author claim ledger を正解として受け取らず、validated audit 後に deterministic comparison を作れる。

## Visual plan

visual plan は image prompt そのものではない。

```json
{
  "strategy": "ai_generated",
  "concept": "...",
  "style_profile": "xpotato-tech-v1",
  "forbidden_depictions": ["fake UI", "terminal text", "benchmark numbers"],
  "safe_area": "...",
  "alt_proposal": "..."
}
```

executor が style profile と hard policy を加えて provider request を compile する。

## Image generation record

生成画像は output bytes が identity である。

record:

- generation request hash
- exact compiled prompt private path / prompt hash
- provider / model / snapshot
- generation parameters
- candidate index
- raw output SHA-256 / dimensions / media type
- provenance signal observation where available
- moderation result
- visual-audit result ref
- selected / rejected status

同じ request を再実行して同一 bytes になることを期待しない。

## Candidate manifest

candidate は human review の approval target。

少なくとも:

- article MDX hash
- resolved frontmatter hash
- selected taxonomy snapshot hash
- hero / social image artifact hashes
- referenced local asset hashes
- source bundle hash
- evidence bundle hash
- content audit hash
- visual audit hash
- repository base commit
- build/profile fingerprints

を束縛する。

## Publication provenance

full Article Job workspace は private とする。

repository へ必要なら compact publication provenance record を export する。

公開 / repo-side record に含める候補:

- article candidate hash
- Article Job ID
- human approval record hash
- source/evidence bundle hashes
- text origin / human-review status
- hero origin
- generated hero provider/model identity + raw/normalized hashes

private source body、credential、provider response全文、prompt全文を public sidecar へ要求しない。

## Workspace layout

proposed layout:

```text
.local/article-jobs/<job-id>/
├─ job.json
├─ sources/
│  ├─ manifest.json
│  └─ snapshots/
├─ evidence/
│  ├─ records.jsonl
│  ├─ ambiguities.json
│  └─ manifest.json
├─ authoring/
│  ├─ requests/
│  ├─ responses/
│  └─ drafts/vNNN/
│     ├─ article.mdx
│     ├─ claims.jsonl
│     ├─ metadata.json
│     └─ visual-needs.json
├─ audit/
│  └─ content/vNNN/
├─ visuals/
│  ├─ plans/vNNN.json
│  ├─ generated/raw/<sha256>/
│  ├─ normalized/<sha256>/
│  └─ audits/vNNN/
├─ candidate/vNNN/
│  ├─ article.mdx
│  ├─ assets/
│  └─ manifest.json
├─ preview/vNNN/
├─ approval/records.jsonl
└─ manifests/stages/
```

`.local/` は Git 管理しない。

## Schema SoT

Article Job schema は TypeScript/Zod domain model を第一の machine-readable SoT とし、provider exchange 用 JSON Schema を生成する。

Zod と手書き JSON Schema を独立に更新する二重 SoT を避ける。
