---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - Article Job state machine
---

# Article Job State Machine

## States

| State | Meaning |
|---|---|
| `CREATED` | validated job spec exists |
| `SOURCES_READY` | source bundle is fixed and verified |
| `EVIDENCE_READY` | evidence / ambiguity ledger is available |
| `DRAFTED` | versioned draft and claim artifacts exist |
| `EXAMPLES_ASSESSED` | technical examples extracted and bounded verification completed |
| `CONTENT_AUDITED` | independent content audit exists |
| `REVISION_REQUIRED` | P0/P1 content finding remains |
| `CONTENT_READY` | content audit is clean |
| `VISUAL_PLANNED` | collection visual requirement and plan set are fixed |
| `VISUAL_READY` | required visual candidates are materialized, or valid empty visual set exists |
| `VISUAL_AUDITED` | visual audit manifest is clean |
| `CANDIDATE_READY` | MDX + metadata + local candidate media are fixed |
| `PREVIEW_VALIDATED` | target candidate successfully built and checked |
| `HUMAN_REVIEW_READY` | human review bundle is fixed |
| `HUMAN_APPROVED` | human approval binds exact candidate hash |
| `MEDIA_PUBLISHED` | approved candidate media objects are verified on R2 |
| `EXPORTED` | approved candidate metadata/content exported to repository branch/patch |
| `BLOCKED` | human decision / evidence / permission / tool required |
| `FAILED` | stage failed without valid output |
| `CANCELLED` | user cancelled the job |

## Normal path

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> SOURCES_READY
    SOURCES_READY --> EVIDENCE_READY
    EVIDENCE_READY --> DRAFTED
    DRAFTED --> EXAMPLES_ASSESSED
    EXAMPLES_ASSESSED --> CONTENT_AUDITED
    CONTENT_AUDITED --> REVISION_REQUIRED: P0/P1
    REVISION_REQUIRED --> DRAFTED: revised
    CONTENT_AUDITED --> CONTENT_READY: P0=0 and P1=0
    CONTENT_READY --> VISUAL_PLANNED
    VISUAL_PLANNED --> VISUAL_READY
    VISUAL_READY --> VISUAL_AUDITED
    VISUAL_AUDITED --> CANDIDATE_READY
    CANDIDATE_READY --> PREVIEW_VALIDATED
    PREVIEW_VALIDATED --> HUMAN_REVIEW_READY
    HUMAN_REVIEW_READY --> HUMAN_APPROVED
    HUMAN_APPROVED --> MEDIA_PUBLISHED
    MEDIA_PUBLISHED --> EXPORTED
```

## Gate summary

### `CREATED -> SOURCES_READY`

- topic / reader / article mode valid
- public/private boundary declared
- network / external AI / image-generation permission declared
- source refs fixed

### `SOURCES_READY -> EVIDENCE_READY`

- evidence references known source records
- current/version-sensitive claims have adequate source
- ambiguity retained
- no source-less external fact promoted

### `EVIDENCE_READY -> DRAFTED`

- fixed evidence bundle
- exact Skill snapshot / response schema
- taxonomy / content / interactive registry snapshot
- draft / claim / metadata / visual-needs outputs validate
- citation markers reference only fixed Source IDs

AI responseをcanonical site contentへ直接writeしない。

### `DRAFTED -> EXAMPLES_ASSESSED`

all article modesでdeterministic example extractorを実行する。exampleが0件でもempty manifestでvalid。

exampleがある場合:

- exact draft span / content hashでrecord化
- illustrative / syntax_checked / sandbox_executed / evidence_observed / not_verifiableへ分類
- arbitrary AI codeをhostで直接実行しない
- sandboxはversioned isolated profileのみ
- system/external mutation commandを自動実行しない
- observed outputはactual execution / evidence lineage required
- failure / limitationをmanifestへ残す

`EXAMPLES_ASSESSED`は全example passの意味ではない。

### `EXAMPLES_ASSESSED -> CONTENT_AUDITED`

fresh auditorが:

- target draft
- fixed evidence
- citation binding
- technical example verification manifest

を入力にmaterial claimを再抽出する。

critical tutorial example failure、unsupported observed output、危険なcommand scope欠落等はP1になり得る。

### Revision loop

- validated findingに限定
- new material claimはevidence binding + re-audit
- changed code/command blockはexample verification stale
- finite revision budget
- P0/P1残存 + budget exhausted => `BLOCKED`

### `CONTENT_AUDITED -> CONTENT_READY`

- P0 = 0
- P1 = 0
- publication blocker = 0

### `CONTENT_READY -> VISUAL_PLANNED`

- collection visual policy fixed
- plan set binds exact clean draft hash
- factual visualとdecorative visualを区別
- Blogではhero plan required
- visual optional/none collectionではempty plan setを許可

### `VISUAL_PLANNED -> VISUAL_READY`

collection policyを満たすvisual candidateをmaterializeする。

Blog:

- source media
- AI-generated conceptual hero
- deterministic cover

のいずれかのhero required。

visual不要collection:

- empty visual candidate setでvalid

AI image permissionがなくてもrequired Blog heroはdeterministic coverへfallback可能。

### `VISUAL_READY -> VISUAL_AUDITED`

visual candidateがあればindependent audit。

- misleading fake UI / terminal / benchmarkなし
- relevance / crop / provenance valid

visual 0件ではempty pass manifestを許可する。ただしrequired visual不足はblocked。

### `VISUAL_AUDITED -> CANDIDATE_READY`

- frontmatter resolved
- citation markers compiled to public footnotes
- technical example manifest current
- collection-required media current
- deterministic social card generated where required
- semantic media registry proposal valid
- planned immutable R2 keys derivable
- publication provenance proposal valid
- candidate manifest binds article / media / audits / evidence / examples

public R2 uploadは要求しない。

### `CANDIDATE_READY -> PREVIEW_VALIDATED`

- ContentId / schema / taxonomy valid
- Astro check/build pass
- preview uses local candidate media adapter
- canonical / OG / structured data / sitemap intent valid
- citation / footnote output valid
- responsive media HTML valid
- accessibility / hydration checks

### `PREVIEW_VALIDATED -> HUMAN_REVIEW_READY`

review bundleはexact candidate / preview / audits / evidence / example verification / planned public mediaをbindする。

### `HUMAN_REVIEW_READY -> HUMAN_APPROVED`

human laneのみapprovalを作成できる。

AI / Skill / fixtureはapproval capabilityを持たない。

### `HUMAN_APPROVED -> MEDIA_PUBLISHED`

- candidate hash matches approval
- public media upload permission valid
- approved local candidate mediaだけをcontent-addressed R2 keyへupload/reuse
- post-upload verification complete
- media 0件ならempty successful publication manifest可

partial failureではstateを`HUMAN_APPROVED`に保ちidempotent retryする。

### `MEDIA_PUBLISHED -> EXPORTED`

- candidate / approval / media publication manifest一致
- repository base checked
- MDX / frontmatter / Media Registry / Publication Provenanceをdeterministic export

PR creation、merge、deployは別external side effect。

## Staleness rules

- source change => evidence and downstream stale
- evidence change => draft and downstream stale
- material draft change => examples / audit and downstream stale
- unchanged example hash + same profile resultはreuse可能
- visual plan change => visual candidate / audit downstream stale
- selected media bytes change => candidate / preview / approval / publication stale
- candidate change after approval => approval stale; publication禁止
- repository base / material build config change => preview revalidation required

## Recovery

same request fingerprint + verified immutable artifactはreuse可能。

media publicationはcontent-addressed keyによりidempotent retry可能。

retryのためにgateを弱めない。
