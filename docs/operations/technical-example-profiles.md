---
status: proposed
owner: operations
last_verified: 2026-08-26
canonical_for:
  - initial technical example verifier profiles
  - sandbox resource/security defaults
  - supported example runtimes
---

# Technical Example Verification Profiles v1

## Purpose

AI-first software記事のcode / command / configuration exampleについて、何をどこまで機械検証したかを再現可能にする。

目的はgeneric remote-code-execution platformを作ることではない。

**安全に検証できるsmall self-contained exampleだけをsandboxで検証し、host/system/network mutationを伴う例は実行しない。**

## Verification classes

既存contractのclass:

- `illustrative`
- `syntax_checked`
- `sandbox_executed`
- `evidence_observed`
- `not_verifiable`

を維持する。

profileが存在することと、そのexampleがautomatic execution対象であることを同一視しない。

## Sandbox baseline

ID:

```text
example-sandbox-v1
```

initial limits:

```yaml
network: none
user: non-root
root_filesystem: read-only
linux_capabilities: none
host_devices: none
host_sockets: none
host_secret_mounts: none
workspace: tmpfs
workspace_max_bytes: 67108864   # 64 MiB
memory_max_bytes: 268435456     # 256 MiB
pids_max: 32
cpu_cores_max: 1
wall_timeout_seconds: 15
combined_output_max_bytes: 1048576  # 1 MiB
```

environment allowlist:

```text
PATH
LANG=C.UTF-8
LC_ALL=C.UTF-8
TZ=UTC
HOME=/tmp/home
TMPDIR=/tmp
```

CI/host environment全体をsandboxへinheritしない。

provider/API/Cloudflare/GitHub credentialsをmountしない。

## Global execution deny

次のexampleはinitial automatic execution対象外:

- `sudo`
- package installation/update
- disk/partition/filesystem management
- mount/unmount
- systemd/service control
- user/group/password operation
- firewall/network interface/routing
- SSH/SCP/rsync remote mutation
- curl/wget/API request requiring network
- Docker/Podman container start/build/push
- Kubernetes/Helm apply
- cloud CLI/provider mutation
- Git push/merge/tag/delete
- destructive database/file command against external state
- hardware/device access
- reboot/shutdown

記事では必要に応じて`illustrative`または`not_verifiable`とし、actual observed evidenceが別にある場合だけ`evidence_observed`へbindする。

command textを安全そうに見えるという理由だけで実行しない。

## Profile: Bash parse/lint

ID:

```text
bash-static-v1
```

scope:

- Bash script syntax
- shell snippet structural lint

operations:

1. `bash -n`
2. pinned ShellCheck if available in toolchain image

**executionしない。**

result class:

- parse/lint pass -> `syntax_checked`
- runtime outputの主張 -> passしても未検証

reason:

shell snippetはfilesystem/process/network mutation capabilityが高く、generic safety classifierだけでexecutionを許可しない。

## Profile: PowerShell parse

ID:

```text
powershell-parse-v1
```

runtime family:

```text
PowerShell 7.6 LTS
```

initial implementation pins exact supported 7.6.x patch in container/toolchain manifest。

operations:

- PowerShell AST/parser syntax validation
- no script execution

result class:

- parse pass -> `syntax_checked`

Windows PowerShell 5.1-specific semantic/exampleはPowerShell 7 parser passだけで5.1動作確認と表現しない。

Windows-only command, registry, service, COM, WMI等はactual Windows evidenceなしなら`not_verifiable`/`illustrative`。

## Profile: Python self-contained

ID:

```text
python-stdlib-v1
```

initial runtime:

```text
Python 3.14.7
```

scope:

- Python standard library only
- self-contained computation/data transform
- local temp-file use within sandbox

checks:

1. compile/parse
2. sandbox execution when risk classifier accepts

restrictions:

- package installなし
- outbound networkなし
- host path accessなし
- subprocess/system command useはinitially execution rejection
- environment/credential dependencyなし

pass:

- syntax only -> `syntax_checked`
- execution completes -> `sandbox_executed`

actual article claimがspecific third-party package/versionに依存する場合、stdlib profileで代替検証しない。

## Profile: Node JavaScript

ID:

```text
node-esm-v1
```

initial runtime:

```text
Node.js 24.19.0 LTS
```

scope:

- self-contained JavaScript/ESM
- built-in pure computation APIs
- local tmpfs file operation where article example requires it

checks:

1. parse/load
2. sandbox execution when accepted

restrictions:

- package installなし
- external npm dependencyなし
- outbound networkなし
- child process/native addon use -> automatic execution reject
- host environment unavailable

third-party package exampleはexact dependency fixture/profileが別途存在しない限り`syntax_checked`/`not_verifiable`。

## Profile: TypeScript typecheck

ID:

```text
typescript-typecheck-v1
```

runtime/toolchain:

- Node 24 LTS
- repository-pinned TypeScript compiler

scope:

- standalone TypeScript type/syntax checking
- site-owned types fixture where deliberately provided

operation:

```text
tsc --noEmit equivalent in isolated fixture
```

executionなし。

result class=`syntax_checked`。

Articleが特定framework/library versionのruntime behaviorを主張する場合、typecheckだけを動作確認としない。

## Profile: SQLite sandbox

ID:

```text
sqlite-sandbox-v1
```

initial runtime:

```text
SQLite 3.53.4
```

scope:

- SQL syntax/query behavior
- schema/index/transaction examples
- disposable local database only

sandbox setup:

- fresh DB under tmpfs
- no extension loading unless explicit allowlisted fixture
- no external filesystem DB
- no network

checks:

1. SQL script execute in fresh DB
2. exit status
3. expected output/assertion when article contract provides one

pass -> `sandbox_executed`。

performance/benchmark numberはsandbox passだけでは`evidence_observed`にならない。benchmark claimはactual benchmark evidenceへbindする。

## Profile: JSON

ID:

```text
json-parse-v1
```

strict JSON parse only。

pass -> `syntax_checked`。

JSONC/YAMLをJSONとしてsilent acceptしない。

## Profile: YAML

ID:

```text
yaml-parse-v1
```

pinned safe YAML parser。

- arbitrary object construction/tag execution禁止
- syntax/duplicate-key policyをversioned configで固定

pass -> `syntax_checked`。

Kubernetes/Compose/CIなどdomain schema correctnessは別schema adapterが存在する場合だけ追加検証する。

## Profile: Docker Compose config

ID:

```text
compose-config-v1
```

optional initial adapter。

scope:

- Compose file parse/normalization only
- service start/build/pullなし

use exact pinned Docker Compose CLI/parser fixture without daemon mutation where supported。

pass -> `syntax_checked`。

containerが実際に起動する、healthcheckが通る、networkが成立する、という主張には使用しない。

## Risk classifier

execution-capable profileへ渡す前にdeterministic classificationを行う。

initial action:

```ts
type ExampleExecutionDecision =
  | "parse_only"
  | "sandbox_execute"
  | "reject_execution";
```

### `sandbox_execute` minimum

- supported execution profile
- no forbidden command/API pattern
- no external credential/input requirement
- no outbound network requirement
- no system/host mutation requirement
- bounded input/output
- self-contained artifact

### fail closed

classifierがunknown/ambiguousなら`reject_execution`。

AIにclassifier override authorityを与えない。

## Expected versus observed output

AI draft中のoutput blockはdefaultで`expected`。

`sandbox_executed` resultとexact example hashへbindされ、actual stdout/stderr/assertionと一致した場合だけsandbox observationとして記録できる。

`evidence_observed`はArticle Job外/別artifactのreal environment evidenceを含み得るため、sandbox resultと同一classにしない。

## Non-determinism

random/time/concurrency/system-dependent exampleは:

- deterministic seed/frozen clock fixtureが明示される場合のみstable assertion
- otherwise execution successとexact output equalityを分離

runが成功しただけで例示出力の全byte一致を保証しない。

## Resource-limit result

次はverification failure/limitationとして記録する:

- timeout
- OOM/resource kill
- PID limit
- output cap
- forbidden network/system operation attempt

resource limitを緩めて自動retryしない。

## Runtime version policy

profile IDがruntime major/minor semanticsへbindする。

patch/security updateはmachine toolchain manifestでpinし、article provenanceへtoolchain hashを残す。

material language/runtime changeではprofile v2を作る。

current initial references:

- Python 3.14.7 — 2026-08-05
- Node.js 24.19.0 LTS — 2026-08-03
- PowerShell 7.6 LTS line
- SQLite 3.53.4 — 2026-07-24

## Initial coverage boundary

initial automatic sandbox execution:

- Python stdlib
- Node self-contained JS
- SQLite disposable DB

initial parse/type-only:

- Bash
- PowerShell
- TypeScript
- JSON/YAML
- Compose config

initial automatic executionなし:

- system administration command sequences
- package managers
- cloud/provider commands
- Git remote mutation
- Docker workload execution
- Windows-specific privileged operations

このsmall boundaryからactual article needで追加する。

## Validation

profile fixtureで:

- permitted minimal example PASS
- network attempt fails
- secret env absent
- `/etc`/host write unavailable
- process-spawn policy enforced where applicable
- timeout enforced
- memory/PID/output limits enforced
- forbidden shell/cloud command execution reject
- parser-only profile never runs target code
- version/toolchain fingerprint recorded

を確認する。

## Current references

- Python releases: https://www.python.org/downloads/
- Node 24 archive/releases: https://nodejs.org/en/download/archive/v24
- PowerShell lifecycle: https://learn.microsoft.com/powershell/scripting/install/powershell-support-lifecycle
- SQLite releases: https://sqlite.org/changes.html
