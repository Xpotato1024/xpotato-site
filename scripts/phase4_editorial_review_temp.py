from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def sync_document_digest() -> None:
    manifest = json.loads(Path("docs/migration/content-materialization-v1.json").read_text(encoding="utf-8"))
    digest = manifest["manifestPayloadSha256"]
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise SystemExit("invalid materialization manifest digest")
    path = Path("docs/migration/content-materialization-2026-08-29.md")
    text = path.read_text(encoding="utf-8")
    text, count = re.subn(
        r"(?m)^- materialization manifest payload SHA-256: `[0-9a-f]{64}`$",
        f"- materialization manifest payload SHA-256: `{digest}`",
        text,
    )
    if count != 1:
        raise SystemExit(f"materialization evidence digest line: expected one match, found {count}")
    path.write_text(text, encoding="utf-8", newline="\n")
    return


if len(sys.argv) > 1:
    if sys.argv[1:] != ["--sync-doc"]:
        raise SystemExit("only --sync-doc is supported")
    sync_document_digest()
    raise SystemExit(0)

schema_path = Path("packages/content-contracts/src/phase4-migration.ts")
schema = schema_path.read_text(encoding="utf-8")
schema = replace_once(
    schema,
    '''export const phase4BodyConversionSchema = z.enum([
  "portable_preserved",
  "legacy_html_to_markdown",
  "interactive_registry_conversion",
]);''',
    '''export const phase4BodyConversionSchema = z.enum([
  "portable_preserved",
  "legacy_html_to_markdown",
  "interactive_registry_conversion",
  "reviewed_editorial_update",
]);''',
    "body conversion enum",
)
schema = replace_once(
    schema,
    '''    interactiveModuleId: stableIdSchema.optional(),
    legacyHtmlRawSha256: sha256Schema.optional(),
    remainingPhases: z.array(phase4RemainingPhaseSchema),''',
    '''    interactiveModuleId: stableIdSchema.optional(),
    legacyHtmlRawSha256: sha256Schema.optional(),
    editorialReviewId: stableIdSchema.optional(),
    remainingPhases: z.array(phase4RemainingPhaseSchema),''',
    "editorial review field",
)
schema = replace_once(
    schema,
    '''    if (value.bodyConversion === "legacy_html_to_markdown") {
      if (!value.legacyHtmlRawSha256) {
        context.addIssue({ code: "custom", message: "LegacyHtml conversion requires raw HTML hash", path: ["legacyHtmlRawSha256"] });
      }
    } else if (value.legacyHtmlRawSha256) {
      context.addIssue({ code: "custom", message: "raw HTML hash is only valid for LegacyHtml conversion", path: ["legacyHtmlRawSha256"] });
    }
  });''',
    '''    if (value.bodyConversion === "legacy_html_to_markdown") {
      if (!value.legacyHtmlRawSha256) {
        context.addIssue({ code: "custom", message: "LegacyHtml conversion requires raw HTML hash", path: ["legacyHtmlRawSha256"] });
      }
    } else if (value.legacyHtmlRawSha256) {
      context.addIssue({ code: "custom", message: "raw HTML hash is only valid for LegacyHtml conversion", path: ["legacyHtmlRawSha256"] });
    }
    if (value.bodyConversion === "reviewed_editorial_update") {
      if (!value.editorialReviewId) {
        context.addIssue({ code: "custom", message: "reviewed editorial update requires review ID", path: ["editorialReviewId"] });
      }
    } else if (value.editorialReviewId) {
      context.addIssue({ code: "custom", message: "editorial review ID is only valid for reviewed editorial updates", path: ["editorialReviewId"] });
    }
  });''',
    "editorial review refinement",
)
schema_path.write_text(schema, encoding="utf-8", newline="\n")

materializer_path = Path("packages/site-validators/src/phase4-content-materialization.ts")
materializer = materializer_path.read_text(encoding="utf-8")
materializer = replace_once(
    materializer,
    '''  readonly interactiveModuleId?: string;
  readonly legacyHtmlRawSha256?: string;
}''',
    '''  readonly interactiveModuleId?: string;
  readonly legacyHtmlRawSha256?: string;
  readonly editorialReviewId?: string;
}''',
    "converted body editorial review field",
)
editorial_definition = r'''
interface ReviewedEditorialBody {
  readonly reviewId: string;
  readonly body: string;
}

const reviewedEditorialBodies = new Map<string, ReviewedEditorialBody>([
  [
    "pages:about",
    {
      reviewId: "phase4-about-current-state-v1",
      body: `このサイトでは、技術メモ、制作記録、補助ノート、小規模なブラウザ内アプリをまとめて公開します。

方針は単純です。

- コンテンツをコードレビュー可能な形で管理する
- 表示速度と SEO を最初から崩さない
- ブログ、ノート、プロジェクト、ブラウザ内アプリを同じ構造で保守する

現在は Astro と MDX を中心に、\`apps/site/src/content/\` のポータブルなコンテンツと必要最小限の Astro / React コンポーネントを、段階的な移行ゲートの下で整備しています。

旧実装の削除や本番切替は、コンテンツ・分類・メディア・URL・SEO・復旧手順の各パリティを確認してから行います。`,
    },
  ],
  [
    "projects:xpotato-site",
    {
      reviewId: "phase4-xpotato-site-current-state-v1",
      body: `このプロジェクトは、WordPress 由来の公開サイトを Astro ベースの静的サイトへ段階移行するための基盤です。

## 目的

- GUI 依存を減らし、コンテンツ・契約・検証をコードレビュー可能にする
- 静的配信を基本にして、必要な箇所だけを明示的なブラウザ内モジュールとして動かす
- ContentId、分類、メディア、URL、公開由来を別々の機械契約で管理する
- 移行完了まで凍結済みの旧実装と復旧証拠を保持する

## 現在の構成

- npm workspace 配下の \`apps/site\` が Astro アプリとapplication-local設定を所有する
- 本文はポータブルな Markdown / MDX と承認済みsemantic moduleで管理する
- ReactはInteractive Module Registryで明示されたislandだけに限定する
- GitHub Actionsでschema、migration evidence、typecheck、build、CSP、search、static outputを決定的に検証する
- 配信先はCloudflare Workers Static Assetsを想定するが、provider activationと本番deployは別gateとしてブロックする

## 移行状況

凍結したlegacy snapshotから恒久ContentIdを割り当て、53件のportable contentを再生成できるPhase 4 pipelineを実装しています。分類、メディア、URL、SEOとdiscoveryのパリティは後続phaseで個別に閉じます。

本番切替、旧実装の削除、Cloudflare・R2・DNSの変更は、後続gateとrollback確認が完了するまで行いません。`,
    },
  ],
]);

export const reviewedEditorialBodyFor = (legacyContentId: string): ReviewedEditorialBody | undefined =>
  reviewedEditorialBodies.get(legacyContentId);
'''
materializer = replace_once(
    materializer,
    '''interface ExpectedMaterialization {
  readonly manifest: Phase4ContentMaterializationManifest;
  readonly files: ReadonlyMap<string, string>;
}
''',
    '''interface ExpectedMaterialization {
  readonly manifest: Phase4ContentMaterializationManifest;
  readonly files: ReadonlyMap<string, string>;
}
''' + editorial_definition,
    "editorial body map insertion",
)
materializer = replace_once(
    materializer,
    '''  let interactiveModuleId: string | undefined;
  let rawHtmlSha256: string | undefined;''',
    '''  let interactiveModuleId: string | undefined;
  let rawHtmlSha256: string | undefined;
  let editorialReviewId: string | undefined;''',
    "editorial review local",
)
materializer = replace_once(
    materializer,
    '''  body = removeDeferredMedia(body, candidate.deferredMediaLocators);
  const titleResult = stripLeadingTitleHeading(body, title);''',
    '''  body = removeDeferredMedia(body, candidate.deferredMediaLocators);
  const editorialReview = reviewedEditorialBodyFor(candidate.legacyContentId);
  if (editorialReview) {
    if (conversion !== "portable_preserved" || candidate.body.status !== "portable_as_is") {
      throw new Error(`${candidate.legacyContentId}: editorial replacement requires a portable source body`);
    }
    body = editorialReview.body;
    conversion = "reviewed_editorial_update";
    editorialReviewId = editorialReview.reviewId;
  }
  const titleResult = stripLeadingTitleHeading(body, title);''',
    "editorial override application",
)
materializer = replace_once(
    materializer,
    '''    ...(interactiveModuleId ? { interactiveModuleId } : {}),
    ...(rawHtmlSha256 ? { legacyHtmlRawSha256: rawHtmlSha256 } : {}),
  };''',
    '''    ...(interactiveModuleId ? { interactiveModuleId } : {}),
    ...(rawHtmlSha256 ? { legacyHtmlRawSha256: rawHtmlSha256 } : {}),
    ...(editorialReviewId ? { editorialReviewId } : {}),
  };''',
    "converted body editorial review return",
)
materializer = replace_once(
    materializer,
    '''      ...(convertedBody.interactiveModuleId ? { interactiveModuleId: convertedBody.interactiveModuleId } : {}),
      ...(convertedBody.legacyHtmlRawSha256 ? { legacyHtmlRawSha256: convertedBody.legacyHtmlRawSha256 } : {}),
      remainingPhases,''',
    '''      ...(convertedBody.interactiveModuleId ? { interactiveModuleId: convertedBody.interactiveModuleId } : {}),
      ...(convertedBody.legacyHtmlRawSha256 ? { legacyHtmlRawSha256: convertedBody.legacyHtmlRawSha256 } : {}),
      ...(convertedBody.editorialReviewId ? { editorialReviewId: convertedBody.editorialReviewId } : {}),
      remainingPhases,''',
    "materialization editorial review record",
)
materializer = replace_once(
    materializer,
    '''  if (files.size !== 53 || records.length !== 53) throw new Error(`Phase 4 must materialize exactly 53 frozen legacy entities, got ${files.size}`);
  if (blogCategoryCounts.software !== 31 || blogCategoryCounts.infrastructure !== 12 || blogCategoryCounts.robotics !== 1) {''',
    '''  if (files.size !== 53 || records.length !== 53) throw new Error(`Phase 4 must materialize exactly 53 frozen legacy entities, got ${files.size}`);
  const reviewedRecordIds = records.filter((record) => record.bodyConversion === "reviewed_editorial_update").map((record) => record.legacyContentId).sort(compareCanonicalKeys);
  const expectedReviewedIds = [...reviewedEditorialBodies.keys()].sort(compareCanonicalKeys);
  if (reviewedRecordIds.join("\\0") !== expectedReviewedIds.join("\\0")) {
    throw new Error(`Reviewed editorial coverage mismatch: ${JSON.stringify(reviewedRecordIds)}`);
  }
  if (blogCategoryCounts.software !== 31 || blogCategoryCounts.infrastructure !== 12 || blogCategoryCounts.robotics !== 1) {''',
    "editorial review coverage assertion",
)
materializer_path.write_text(materializer, encoding="utf-8", newline="\n")

test_path = Path("packages/site-validators/src/phase4-content-materialization.test.ts")
test = test_path.read_text(encoding="utf-8")
test = replace_once(
    test,
    '''  htmlFragmentToPortableMarkdown,
  stripLeadingTitleHeading,''',
    '''  htmlFragmentToPortableMarkdown,
  reviewedEditorialBodyFor,
  stripLeadingTitleHeading,''',
    "editorial review test import",
)
test = replace_once(
    test,
    '''  it("removes only an exact duplicate leading title heading", () => {
    expect(stripLeadingTitleHeading("# 同じ題名\\n\\n本文", "同じ題名")).toEqual({ source: "本文", removed: true });
    expect(stripLeadingTitleHeading("# 別の見出し\\n\\n本文", "同じ題名")).toEqual({ source: "# 別の見出し\\n\\n本文", removed: false });
  });
});''',
    '''  it("records the two reviewed current-state editorial replacements", () => {
    const about = reviewedEditorialBodyFor("pages:about");
    const project = reviewedEditorialBodyFor("projects:xpotato-site");
    expect(about?.reviewId).toBe("phase4-about-current-state-v1");
    expect(about?.body).toContain("apps/site/src/content/");
    expect(project?.reviewId).toBe("phase4-xpotato-site-current-state-v1");
    expect(project?.body).toContain("Cloudflare Workers Static Assets");
    expect(project?.body).toContain("本番切替");
    expect(reviewedEditorialBodyFor("projects:csv2g")).toBeUndefined();
  });

  it("removes only an exact duplicate leading title heading", () => {
    expect(stripLeadingTitleHeading("# 同じ題名\\n\\n本文", "同じ題名")).toEqual({ source: "本文", removed: true });
    expect(stripLeadingTitleHeading("# 別の見出し\\n\\n本文", "同じ題名")).toEqual({ source: "# 別の見出し\\n\\n本文", removed: false });
  });
});''',
    "editorial review test",
)
test_path.write_text(test, encoding="utf-8", newline="\n")

doc_path = Path("docs/migration/content-materialization-2026-08-29.md")
doc = doc_path.read_text(encoding="utf-8")
doc = replace_once(
    doc,
    '''| Portable source preserved | 50 | runtime imports/presentation-owned fields removed; portable MDX revalidated |
| Static `LegacyHtml` to Markdown | 2 | static literal only; raw HTML SHA verified; no evaluation |
| Interactive Registry conversion | 1 | legacy PrimeFactorizer component path replaced by `Demo module="prime-factorizer"` |''',
    '''| Portable source preserved | 48 | runtime imports/presentation-owned fields removed; portable MDX revalidated |
| Reviewed current-state editorial update | 2 | exact review IDs bind replacements for About and Xpotato Site; source hashes remain preserved |
| Static `LegacyHtml` to Markdown | 2 | static literal only; raw HTML SHA verified; no evaluation |
| Interactive Registry conversion | 1 | legacy PrimeFactorizer component path replaced by `Demo module="prime-factorizer"` |''',
    "conversion evidence table",
)
doc = replace_once(
    doc,
    '''Media references removed from portable bodies are not discarded. Exact legacy locators remain in `content-materialization-v1.json` for Phase 6.

## Publication staging''',
    '''Media references removed from portable bodies are not discarded. Exact legacy locators remain in `content-materialization-v1.json` for Phase 6.

## Reviewed current-state corrections

Two pages whose legacy wording described an already superseded implementation plan receive explicit, version-controlled editorial replacements:

- `pages:about` -> `phase4-about-current-state-v1`
- `projects:xpotato-site` -> `phase4-xpotato-site-current-state-v1`

The replacements correct the workspace path, current static-first architecture, migration-phase status, target Cloudflare Static Assets boundary, and retained cutover/provider blocks. They do not alter ContentId, title, description, historical source hashes, or deferred taxonomy/media evidence.

All six Project frontmatter records were reviewed against the frozen source. Public repository links, legacy status, featured ordering, and source-availability semantics are retained. Raw technologies/tags remain Phase 5 evidence rather than being silently accepted into the target taxonomy.

## Publication staging''',
    "reviewed editorial evidence section",
)
doc_path.write_text(doc, encoding="utf-8", newline="\n")
