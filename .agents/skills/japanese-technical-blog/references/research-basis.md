# Research Basis

この reference は Skill の設計根拠をまとめる。記事本文へこの構造をコピーするためのテンプレートではない。

## 1. Agent Skill design

Agent Skills open specification:

- https://agentskills.io/specification
- https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx

採用した原則:

- `SKILL.md` を入口にする。
- `name` / `description` で scope と trigger を狭くする。
- 詳細 evidence / templates は `references/` へ分離する。
- 1 Skill に多数の隣接 job を詰め込まない。
- progressive disclosure を使い、常時 context を肥大化させない。

## 2. OSS Skill patterns reviewed

第三者 Skill の wording をコピーせず、workflow pattern の比較材料として参照した。

### inference-sh / technical-blog-writing

- registry overview: https://skillmd.com/plugins/skillmd/publish-technical-blog-post
- mirror overview: https://www.skills.sh/101-skills/skills/technical-blog-writing

参考にした pattern:

- developer audience に article type を合わせる
- code example と explanation depth を明示する
- tutorial / deep dive / postmortem / architecture article を同じテンプレートへ押し込まない

### Mark-Life / writing-for-readers

- https://github.com/Mark-Life/agent-skills/blob/main/skills/communication/writing-for-readers/SKILL.md

参考にした pattern:

- reader が skim する前提で prose を review する
- first draft をそのまま正解とせず redundant prose を削る
- instruction の形を published prose にコピーしない

### mazrean / writing-technical-design

- https://github.com/mazrean/agent-skills/blob/main/skills/writing-technical-design/SKILL.md

参考にした pattern:

- technical component の claim を current official source で調査する
- source / design rationale を implementation-time knowledge と分離する

上記 OSS source は inspiration / comparison であり、この repository Skill の normative source は `docs/content/editorial-policy.md` とこの reference に記録した一次研究である。

## 3. Japanese readability evidence

### Tateisi, Ono, Yamada (COLING 1988)

Yuka Tateisi, Yoshihiko Ono, Hisao Yamada, “A Computer Readability Formula of Japanese Texts for Machine Scoring”

- https://aclanthology.org/C88-2135/

研究では、平均 sentence length、character type の連続、run length、comma / period ratio 等の surface feature を Japanese readability formula に使用し、実験的に評価した。

Skill への解釈:

- sentence complexity / length は review signal として意味がある。
- しかし研究式の数値を現代の技術ブログへ universal hard limit として転用しない。
- 長い複文、句読点不足、異種情報の過密を editorial review する根拠とする。

### Sato, Matsuyoshi, Kondoh (LREC 2008)

Satoshi Sato, Suguru Matsuyoshi, Yohsuke Kondoh, “Automatic Assessment of Japanese Text Readability Based on a Textbook Corpus”

- https://aclanthology.org/L08-1230/

1,478 passages / 127 textbooks / 13 grade levels から Japanese readability を corpus-based に評価した研究。

Skill への解釈:

- readability は target reader / text difficulty と関係する。
- 単一の「良い文章スコア」を全 reader へ強制しない。
- target reader と前提知識を先に定義し、専門語・説明密度を調整する。

## 4. Worked examples / technical instruction

### Margulieux et al., International Journal of STEM Education (2020)

“Reducing withdrawal and failure rates in introductory programming with subgoal labeled worked examples”

- https://link.springer.com/article/10.1186/s40594-020-00222-7

programming novice に worked examples / subgoal labeling を適用した研究。novice が surface feature に偏りやすいこと、solution structure を明示する instructional design の価値を論じる。

### van Gog et al., Contemporary Educational Psychology (2011)

“Effects of worked examples, example-problem, and problem-example pairs on novices’ learning”

- https://doi.org/10.1016/j.cedpsych.2010.10.004

novice learning では worked example study が conventional problem solving より低い cognitive load と高い learning outcome を示した条件を報告している。

Skill への解釈:

- novice 向け tutorial では、完成コードだけを置くより目的と solution step / structure を見せる。
- worked example effect をすべての expert 向け記事へ一般化しない。
- experience level と article mode に応じて example depth を変える。

## 5. Evidence discipline

上記研究は prose の万能テンプレートを証明するものではない。

したがって Skill は:

- rigid sentence-length rule を設けない
- 「必ず hook」「必ず N section」のような universal structure を設けない
- readability / cognitive-load evidence を target reader、segmentation、worked example review の根拠として限定利用する
- correctness / provenance を readability より優先する

という境界を持つ。
