---
status: proposed
owner: architecture
last_verified: 2026-08-26
canonical_for:
  - technical code and command example verification
  - example execution provenance
---

# Technical Example Verification Contract

## Goal

AIが生成したcode、CLI、configuration、expected outputを「本文の一部だから正しい」と扱わない。

software-oriented articleのtechnical exampleを独立artifactとして抽出し、可能な範囲でdeterministic validation / isolated execution / evidence bindingを行う。

## Verification classes

```ts
type ExampleVerificationClass =
  | "illustrative"
  | "syntax_checked"
  | "sandbox_executed"
  | "evidence_observed"
  | "not_verifiable";
```

### illustrative

概念説明用。実行済みとは主張しない。

### syntax_checked

parser / compiler / schema validator等でsyntax / type等の限定検証を通過。

### sandbox_executed

固定されたisolated execution profileで実行し、exit / output artifactを記録。

### evidence_observed

ユーザー提供log、repository CI、実測artifact等のfixed evidenceが「実際にこの結果を得た」ことをsupportする。

### not_verifiable

hardware / production service / privileged environment等のため安全・再現可能な自動検証ができない。未検証理由を明示する。

## Example record

```ts
interface TechnicalExampleRecord {
  exampleId: string;
  draftSha256: string;
  sourceSpan: {
    start: number;
    end: number;
  };

  kind:
    | "code"
    | "shell_command"
    | "configuration"
    | "query"
    | "expected_output";

  language?: string;
  contentSha256: string;
  intendedPurpose: string;
  requestedVerification: ExampleVerificationClass;
}
```

AI author may propose verification class, but cannot mark result `pass`.

## Verification result

```ts
interface TechnicalExampleVerificationResult {
  exampleId: string;
  class: ExampleVerificationClass;
  status: "pass" | "fail" | "not_run" | "blocked";

  verifier?: {
    kind: "parser" | "compiler" | "schema" | "sandbox" | "evidence_binding";
    name: string;
    version: string;
  };

  executionProfileId?: string;
  inputArtifactSha256?: string;
  stdoutSha256?: string;
  stderrSha256?: string;
  exitCode?: number;
  evidenceIds?: string[];

  limitations: string[];
  verifiedAt?: string;
}
```

stdout / stderr全文をpublic Gitへ保存する必要はない。Article Job private artifactへ保持し、必要なobserved outputだけarticleへexportする。

## Extraction

DRAFTED後、deterministic extractorがMDX ASTから:

- fenced code block
- explicitly marked command block
- configuration block
- output block

を抽出する。

prose内の1行commandまで無差別自動実行しない。

## Verification policy by article mode

### tutorial

readerがそのまま実行するmaterial command / codeは、可能なら`syntax_checked`以上を要求する。

`not_verifiable`でもpublish可能だが、本文の「確認済み」「動作する」等の断定は禁止し、limitationを明示する。

### investigation / incident

実際のoutputを事実として示す場合は`evidence_observed`を要求する。

AIがもっともらしいterminal outputを生成してobservedとして扱うことを禁止する。

### explanation

illustrative pseudo-codeを許可する。実コードとの区別が読者に明確であること。

## Sandbox execution boundary

arbitrary AI-generated codeをhostで直接実行しない。

sandbox profileはversion-controlled definitionを持つ。

minimum properties:

- disposable environment
- explicit language/runtime/tool version
- workspace size limit
- wall-clock timeout
- CPU / memory limit where available
- no host credential mount
- no canonical repo write
- stdout / stderr size limit
- child process limit where practical
- network default deny

networkが必要なverificationはseparate profile + explicit job permission + allowlistを要求する。

## Shell command policy

shell commandは危険度を分類する。

```ts
type CommandRisk = "read_only" | "workspace_mutation" | "system_mutation" | "external_mutation";
```

- read_only: sandbox実行候補
- workspace_mutation: disposable sandbox内のみ
- system_mutation: automatic execution default deny
- external_mutation: automatic execution禁止。mock / dry-run / evidence bindingへ切替

`sudo`, disk/partition commands, credential operations, deploy, delete, package registry publish等をhostで自動実行しない。

## Environment fidelity

sandbox passは「すべての環境で動く」の証明ではない。

verification recordへruntime / OS / architecture等のprofile identityをbindし、記事では必要な前提条件を示す。

## Expected / observed output

AIがexpected outputを説明として提示することは可能。

ただし:

- `expected`: docs / reasoningから導く予想
- `observed`: actual sandbox or evidence artifactから取得

を区別する。

`observed` textをArticle Job author responseで自由生成しない。

deterministic executorがverification artifactから必要部分をarticle candidateへinject / validateできる。

## Revision staleness

code block bytesが変わればprevious verificationはstale。

semantic revision後、changed exampleだけ再検証する。

unchanged content hashのexample resultは同一execution profileならreuse可能。

## Content audit integration

independent auditorへ:

- example records
- verification results
- limitations

をfixed audit inputとして渡す。

P1 candidate:

- article claims tested but result is not_run
- shown observed output lacks evidence
- dangerous command lacks scope/warning
- code API version mismatches cited current source
- tutorial critical example fails verification

## Publication provenance

compact publication provenanceへverification summary hashを追加できる。

full execution logsはprivate。

## No automatic claim inflation

`syntax_checked=pass`を「動作確認済み」に変換しない。

`sandbox_executed=pass`もproduction suitability / security / performanceを証明しない。

## Validation

- every material example has record or explicit exemption
- result binds exact draft/example hash
- observed output has sandbox/evidence lineage
- no host direct execution route
- networked verification has explicit permission/profile
- failed critical tutorial example blocks clean audit unless corrected or clearly reclassified
