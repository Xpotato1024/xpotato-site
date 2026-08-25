# AGENTS.md

## Scope

このファイルは `Xpotato1024/xpotato-site` で作業する AI agent 向け repository-local instruction である。

恒常ルールを個別 prompt に重複転記せず、`docs/README.md` の Source of Truth Map と task に関係する canonical document を読んで判断する。

## Read first

作業前に、必要な範囲で次を確認する。

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/product/product-context.md`
4. Blog authoring / generation task なら `docs/product/ai-authoring-context.md`
5. task に関係する canonical architecture / content / operations document
6. material な設計判断なら `docs/design/adr/`
7. 関連実装と validation

product context は framework / implementation preference より上位に置く。特に、日常運用の中心が MDX 記事の継続追加・更新であること、Blog authoring が AI-first であること、SEO / taxonomy / media / archive / delivery optimization を可能な限り自動化することを判断基準とする。

vNext 設計の採用前は `docs/` の `status: proposed` を尊重し、設計文書が存在することだけを理由に既存コードを勝手に migration しない。

## Current and legacy documentation

- vNext の documentation root は `docs/`。
- 既存 `doc/` と旧 README 内の詳細運用説明は legacy / migration evidence として扱う。
- `doc/` に新しい current document を追加しない。
- ADR は decision history であり current SoT ではない。
- current / target specification は `docs/README.md` から canonical document を辿る。
- legacy と vNext を同じ文書へ混ぜて現状追認しない。

## Article Job invariants

AI-first article workflow では次を守る。

- AI semantic runner は canonical `src/content/` へ直接 write しない。
- fixed request + Skill snapshot + response schema を semantic runner へ渡し、deterministic import を通す。
- source、evidence、draft、audit、visual、candidate、approval を別 artifact として扱う。
- author と independent auditor を同一 hidden context に依存させない。
- AI / Skill は human approval を生成できない。
- human approval は exact candidate hash に bind する。
- Blog candidate は hero visual を持つ。
- AI-generated hero は evidence として扱わない。
- image generation failure / unauthorized は deterministic cover へ fallback 可能にする。

詳細は `docs/architecture/article-pipeline.md`、`article-artifact-model.md`、`article-state-machine.md`、`ai-content-operating-model.md` を正とする。

## Core frontend invariants

- static HTML first。通常 route は Astro で prerender する。
- production に Node.js server を要求しない。Node.js は build toolchain に限定する。
- 通常 UI は Astro component を使う。
- React は stateful な interactive island に限定し、static component を React 化しない。
- `client:*` hydration は opt-in。必要な最も遅い directive を選ぶ。
- site-wide SPA / ClientRouter は default にしない。
- Tailwind CSS 4 + CSS design tokens を target とし、CSS-in-JS runtime を追加しない。
- performance と accessibility は visual design 後の補修ではなく architecture constraint とする。

詳細は `docs/architecture/frontend-policy.md` と `docs/architecture/performance-accessibility-policy.md` を正とする。

## Content invariants

- MDX / Markdown を final article content の標準とする。
- 通常 article の SEO metadata、archive membership、responsive image variant を手作業で個別管理させない。
- 新規 content は current Content Layer / schema に従う。
- unknown category / tag を暗黙 fallback しない。
- taxonomy は registry の stable ID を正とする。
- raw WordPress HTML / `LegacyHtml` を新規 publishing の標準経路にしない。
- `legacyPath` 等を記録しただけで redirect が有効になったとみなさない。
- version / provider behavior / software status のように変わり得る主張は current source を確認する。
- benchmark、measurement、log、incident cause を観測なしに生成しない。

詳細は `docs/architecture/content-architecture.md` と `docs/content/editorial-policy.md` を正とする。

## Media invariants

- iPhone の HEIC / HEIF を authoring input として許容する。
- Web の都合で撮影設定を JPEG 固定へ変更することを standard requirement にしない。
- raw HEIC / HEIF を通常の public repository asset として commit しない。
- camera media は ingest で orientation、sRGB、privacy metadata、size、filename を正規化する。
- AI-generated raw image は provider provenance を無条件に strip せず、generation record と raw hash を先に固定する。
- 通常記事画像は `src/assets` 側で build-time optimization できる構成を優先し、`public/` を記事写真の標準置き場にしない。
- R2 は large / high-volume / downloadable media 用とし、versioned / immutable identity を優先する。
- generated hero に fake UI / terminal / benchmark / factual screenshot を作らせない。

詳細は `docs/architecture/media-pipeline.md`、`synthetic-media-policy.md`、`content-delivery-policy.md` を正とする。

## Preferred Skills

現在 repository に存在する Skill:

- `$japanese-technical-blog`: 日本語の技術ブログ記事について、調査、claim/evidence 整理、構成、draft、推敲、fact/source review を行う。
- `$site-content-publish`: approved article を repository の MDX / frontmatter / taxonomy / media reference 規約へ組み込み、repository-local validation 可能な状態へする。

Article Job 実装時は source / evidence / author / audit / visual planning を narrower stage Skill へ分離する。proposed topology は `docs/architecture/ai-content-operating-model.md` を正とし、未実装 Skill 名を存在するものとして扱わない。

### Skill routing rules

- architecture doc、ADR、runbook、README の執筆に `$japanese-technical-blog` を自動適用しない。
- deterministic source pin / schema validation / image generation provider call / media normalization を Skill prose に実装しない。
- raw camera media の decode / normalize は deterministic media-ingest tool の責務とする。
- Skill は permission を拡張しない。production deploy、R2 upload、credential operation、external mutation は別の明示 scope を必要とする。
- Skill の詳細を AGENTS.md へ複製せず `.agents/skills/<name>/SKILL.md` を読む。

Skill governance は `docs/operations/agent-skill-governance.md` を正とする。

## Git and change policy

- `main` へ直接 commit / push しない。
- feature branch と PR を標準とする。
- framework / route / schema / runtime boundary の material change は canonical docs を同期し、必要なら ADR を追加する。
- unrelated cleanup や visual redesign を migration PR に混ぜない。
- 既存 user change を無関係に上書きしない。

## Validation

実装変更では repository-defined deterministic entrypoint を使い、少なくとも type / Astro check、production build、該当 validator を実行する。

content-only 変更でも schema、taxonomy、route、asset、redirect 等の機械検査を迂回しない。

Article Job semantic response は response schema / fingerprint / source-evidence binding を deterministic import で検査する。

vNext migration 前に current implementation と proposed design が不一致の場合は、不一致を隠さず migration debt として報告する。

詳細は `docs/operations/validation.md` と `docs/operations/article-ai-exchange.md` を正とする。

## Infrastructure boundary

`xpotato-site` は application、content、build contract、site route / delivery semantics を所有する。

Cloudflare account / zone、DNS、共有 R2 resource、zone-level Cache / Compression Rules 等の infrastructure fact / desired state は `Xpotato1024/Xpotato-Server` を正とする。provider ID や credential をこの repository に第二の SoT として複製しない。

詳細は `docs/operations/deployment-boundary.md` を正とする。

## Human-facing language

repository の人間向け documentation、Issue / PR body、article は原則として日本語で作成する。code identifier、formal product name、CLI、protocol literal、出典 title は必要に応じて原文を維持する。

## Safety

- secret、token、credential、private-only information を commit / publish しない。
- article 化するときは公開可能な情報だけを使用する。
- camera image source の EXIF / GPS を public derivative に残さない。
- generated media origin / provenance を意図せず消さない。
- destructive migration、production mutation、external upload、merge は明示依頼なしに行わない。
