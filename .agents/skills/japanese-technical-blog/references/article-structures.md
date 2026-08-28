# Article Structures

固定 template ではなく、primary reader goal に合わせて選択する outline pattern。

## Explanation

適する問い: 「これは何か」「なぜこう動くか」

候補:

1. reader が引っかかる現象 / question
2. 必要な background
3. mechanism / data flow / model
4. concrete example
5. common misconception / boundary
6. practical implication

## Tutorial

適する問い: 「これを実行できるようになりたい」

候補:

1. achievable outcome
2. prerequisites / version
3. smallest working path
4. step-by-step implementation
5. expected observation after key steps
6. why the important steps work
7. failure modes / troubleshooting
8. cleanup / next extension

手順だけの command dump にしない。

## Investigation

適する問い: 「なぜこの現象が起きたか」

候補:

1. symptom / scope
2. known facts
3. hypotheses
4. evidence-gathering method
5. observations
6. hypothesis elimination / support
7. conclusion with confidence
8. unresolved questions

原因を最初から確定した物語として書かない。

## Build log

適する問い: 「何を、なぜ、この設計で作ったか」

候補:

1. problem / target
2. constraints
3. options considered
4. chosen architecture
5. implementation milestones
6. surprising issue / trade-off
7. current result
8. next limitation

commit chronology の羅列にしない。

## Incident / troubleshooting

適する問い: 「同じ問題を診断・回避したい」

候補:

1. symptom
2. affected environment / version
3. immediate impact
4. diagnosis evidence
5. root cause or bounded cause
6. fix
7. verification
8. prevention / detection

root cause が未確定なら workaround と cause を混同しない。

## Comparative review

適する問い: 「A/B/C のどれを選ぶべきか」

候補:

1. decision context
2. evaluation criteria
3. options
4. evidence by criterion
5. trade-off matrix
6. recommendation by scenario
7. limitations / missing data

最初に winner を決めて evidence を後付けしない。

## Cross-cutting rules

- section title は reader が得る情報を示す。
- source file / repository directory 順に outline を作らない。
- context の重複を減らす。
- details が横道なら aside / note / link に退避する。
- conclusion は applicability / limitation / next action の価値を持たせる。
