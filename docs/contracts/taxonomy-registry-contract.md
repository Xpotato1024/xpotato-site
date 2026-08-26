---
status: proposed
owner: content
last_verified: 2026-08-26
canonical_for:
  - category registry contract
  - tag registry contract
  - Notes subject registry contract
  - Tool category registry contract
  - archive generation policy
---

# Taxonomy Registry Contract

## Principle

category / subject / tool category / tagはfrontmatterのfree-form textではなく、version-controlled registryのstable IDを参照する。

表示label変更でcontent全件を書き換えない。

AI / importerはunknown termを勝手にregistryへ追加しない。

## Blog Category

```ts
interface CategoryRecord {
  id: string;
  label: string;
  description: string;
  slug: string;
  indexable: boolean;
  aliases: string[];
  sortOrder?: number;
  status: "active" | "retired";
}
```

Blog Categoryは**broad topical domain**。Blog記事はexactly one active categoryを参照する。

記事の形式・進行状態・書き方をcategoryへ混ぜない。`build_log`、`investigation`、`tutorial`等はArticle Job mode / editorial metadata側の責務。

## Initial Blog category seed

2026-08-26 current-site inventoryに基づき、vNext migration開始時のtop-level Blog categoryは次の3件をseedとする。

| ID | Label | Migration baseline |
|---|---|---|
| `software` | ソフトウェア | current raw `category=devlog` 31件 |
| `infrastructure` | インフラ | current infrastructure family 11件 + ConoHa network 1件 |
| `robotics` | ロボティクス | current `vibration-robot` 1件 |

current public UIの`diary`は30件のGale software devlog + vibration-robotがfallbackで混在しているため、vNext categoryとして継承しない。

current `app`はpublished entry 0件のためseedしない。softwareへ統合する。

current `network`はpublished entry 1件のためseed categoryにせず、initially infrastructure + topic/technology tagで表現する。

migration validatorはcurrent 44 Blog entriesがseed mappingでexactly once partitionされることをfixtureとして検証する。

future category追加は、複数contentを継続的にまとめるreader valueを示してから行う。

## Note Subject

```ts
interface NoteSubjectRecord {
  id: string;
  label: string;
  description: string;
  slug: string;
  archive: boolean;
  indexable: boolean;
  aliases: string[];
  status: "active" | "retired";
}
```

Notesの大分類。

Blog Categoryと意味を無理に共通化しない。たまたま同じlabelでも別namespaceでよい。

### Initial seed

current Notesは1件のみでsubject=`infrastructure`。

initial Note Subject seedは`infrastructure` 1件とし、利用実績のないsubjectを先行生成しない。

## Tool Category

```ts
interface ToolCategoryRecord {
  id: string;
  label: string;
  description: string;
  slug: string;
  indexable: boolean;
  aliases: string[];
  status: "active" | "retired";
}
```

Tool discovery用の少数分類。

### Initial seed

current ToolはPrimeFactorizer 1件でcategory=`calculation`。

initial Tool Category seedは`calculation` 1件とする。

legacy codeには`documents` / `utility`も定義されているがpublished contentがないため、vNext registryへ使用前から追加しない。

## Tag

```ts
type TagKind = "technology" | "topic";

interface TagRecord {
  id: string;
  label: string;
  slug: string;
  kind: TagKind;
  description?: string;
  aliases: string[];
  archive: boolean;
  indexable: boolean;
  status: "active" | "retired";
}
```

Tagはcollection横断で使用できる。

- `technology`: Astro、TypeScript、Docker等
- `topic`: migration、security、math、network等

Projectの`stack`は`kind=technology`だけを参照する。

## Initial tag registry generation

initial tag recordsをこのprose documentへ手書き列挙しない。

legacy/current contentをsame frozen commitからmachine scanし、raw tag / Project technology valueをfrequency集計したmigration artifactを入力にregistryを生成・reviewする。

review classification:

- `active`: canonical stable tag
- `alias`: spelling / display-name variant
- `merge`: semanticsが同一
- `retire`: typo / one-off / no-longer-useful
- `metadata_only`: archiveを作らないtag

current inventoryから少なくとも次のnormalization needが確認済み:

```text
TypeScript / typescript -> one stable ID
Tailwind CSS / tailwind -> one stable ID
programing             -> typo/retire or programming alias
webサーバー             -> normalized topic ID + Japanese label
univ                    -> one-off candidate; review required
```

frequent current clustersとしてsoftware (`gale`, `rust`, `gpu`, `sqlite`, `performance`)、AI/RAG (`rag`, `qdrant`, `vllm`, `anythingllm`)、platform (`windows`, `wsl`, `ssh`, `vps`)等が存在する。

exact initial registry fileはmigration generator output + human reviewをmachine-readable SoTとする。

## Alias resolution

候補stringをregistryへ解決する。

例:

```text
"TypeScript" -> id: typescript
"ts"         -> alias -> typescript
```

resolution orderはexact ID -> normalized label -> alias等、implementationで決定的にする。

ambiguous aliasは禁止。

unknown candidateはtaxonomy proposal artifactへ出し、人間承認かtaxonomy-specific PRを要求する。

## Retired term

retired IDを過去contentから即削除しない。

- new contentへの使用は禁止
- replacementがある場合はmigration mappingを持てる
- existing archive URLを維持する必要性を判断

term renameとID changeを同一視しない。表示名変更だけならstable IDを維持する。

## Archive policy

### Blog category

`/blog/category/<slug>/`

active categoryはarchive生成。`indexable=true`だけsearch index対象。

### Blog tag

`archive=true`だけ `/blog/tag/<slug>/` を生成。

metadata purposeだけのtagはarchiveを作らない。

### Note subject

`archive=true`だけ `/notes/subject/<slug>/` を生成。

### Tool category

初期は `/tools/` 上のfilter / groupingを基本とする。

独立archive URLが必要になった場合、route policyを追加する。frontmatter ID自体はその変更から独立する。

### Year archive

Blog: `/blog/archive/<yyyy>/`

記事が1件以上あるyearだけ生成。

month archiveは初期非対応。

## SEO policy

indexable archiveは:

- unique title / description
- stable canonical URL
- meaningful content list
- crawlable normal links

を持つ。

薄いarchiveをSEO目的で大量生成しない。

## Registry location

vNext candidate:

```text
apps/site/src/content-registry/taxonomy/
  blog-categories.ts
  note-subjects.ts
  tool-categories.ts
  tags.ts
```

implementation後はTypeScript registryをexact machine SoTとする。

## Validation

- IDs / slugs unique per namespace
- aliases ambiguous禁止
- retired termをnew contentで使用禁止
- `indexable=true`ならarchive/page生成可能なtermだけ
- Project stack -> technology tagのみ
- unknown AI proposalをsilent create禁止
- legacy migration mappingはall published raw termsをactive/alias/merge/retireのいずれかへexplicit disposition
- current 44 Blog fixtureはinitial 3 categoriesへexactly once分類
