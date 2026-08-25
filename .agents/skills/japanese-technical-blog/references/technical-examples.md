# Technical Examples

## Goal

code / command / configuration を「載せること」ではなく、読者が mechanism と判断を理解できる worked example にする。

## Default pattern

### 1. State the intent

example の前に、何を確認するための例かを1〜2文で示す。

### 2. Give enough context

snippet が成立するために必要な:

- version
- file / command context
- input
- relevant surrounding type / config

を示す。

全文を貼る必要はないが、reader が hidden assumption を推測しないと意味が分からない断片を避ける。

### 3. Prefer one conceptual change at a time

novice 向けでは、1 snippet で複数 architecture concept を同時導入しない。

大きい complete sample が必要な場合は、先に重要部分を分節して説明し、最後に全体へ統合する。

### 4. Explain mechanism after the example

line-by-line commentary を機械的に付けるのではなく、reader が次の問題へ transfer するために必要な mechanism / decision を説明する。

### 5. Separate expected and observed output

- `expected`: docs / reasoning 上の期待
- `observed`: 実際に command / experiment で得た結果

実行していない output を observed と書かない。

### 6. Show failure boundary when useful

troubleshooting article では successful path だけでなく、diagnostic value が高い error / counterexample を示してよい。

ただし novice に detection できないほど複雑な erroneous example を教育目的で無造作に入れない。

## Code quality

public article の sample code も:

- secret を含めない
- obsolete API を current として示さない
- placeholder と literal command を明確に区別する
- destructive command は effect / scope を明記する
- language tag を付ける
- unnecessary boilerplate を削る

## Evidence

worked example の教育的利用については `research-basis.md` を参照する。
