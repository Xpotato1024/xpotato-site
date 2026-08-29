from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


materializer = Path("packages/site-validators/src/phase4-content-materialization.ts")
text = materializer.read_text(encoding="utf-8")

if "const inlineListItemTags" not in text:
    marker = '\nconst renderList = (node: HtmlNodeLike, ordered: boolean): string => {'
    insertion = '''
const inlineListItemTags = new Set(["strong", "b", "em", "i", "code", "a", "span", "small", "mark", "sup", "sub", "br", "img"]);
const isInlineListItemChild = (node: HtmlNodeLike): boolean =>
  node.nodeName === "#text" || inlineListItemTags.has(tagName(node));
'''
    text = replace_once(text, marker, insertion + marker, "inline list helper insertion")
text = replace_once(
    text,
    '    const content = renderBlockChildren(item).trim();',
    '    const content = childNodes(item).every(isInlineListItemChild)\n      ? childNodes(item).map(renderInline).join("").trim()\n      : renderBlockChildren(item).trim();',
    "inline list rendering",
)
text = replace_once(
    text,
    'const publicationFields = (data: Readonly<Record<string, unknown>>): Record<string, unknown> => {',
    'const publicationFields = (data: Readonly<Record<string, unknown>>, targetDraft: boolean): Record<string, unknown> => {',
    "publication fields signature",
)
text = replace_once(text, '    draft: data.draft === true,', '    draft: targetDraft,', "publication draft")
text = replace_once(
    text,
    '  data: Readonly<Record<string, unknown>>,\n): Readonly<Record<string, unknown>> => {\n  const updatedDate = optionalIsoDate(data.updatedDate, "updatedDate", entry.legacyPath);\n  const publication = publicationFields(data);',
    '  data: Readonly<Record<string, unknown>>,\n  targetDraft: boolean,\n): Readonly<Record<string, unknown>> => {\n  const updatedDate = optionalIsoDate(data.updatedDate, "updatedDate", entry.legacyPath);\n  const publication = publicationFields(data, targetDraft);',
    "frontmatter staging parameter",
)
text = replace_once(
    text,
    '    const frontmatter = buildFrontmatter(entry, candidate, data);',
    '    const targetDraft = entry.collection === "blog" ? true : candidate.draft;\n    const frontmatter = buildFrontmatter(entry, candidate, data, targetDraft);',
    "frontmatter construction",
)
text = replace_once(
    text,
    '      targetFrontmatterSha256: fingerprint(frontmatter),\n      bodyConversion: convertedBody.conversion,',
    '      targetFrontmatterSha256: fingerprint(frontmatter),\n      sourceDraft: candidate.draft,\n      targetDraft,\n      publicationHoldReasons: entry.collection === "blog" && !candidate.draft ? ["blog_media_registry"] : [],\n      bodyConversion: convertedBody.conversion,',
    "materialization publication hold evidence",
)
materializer.write_text(text, encoding="utf-8", newline="\n")

test_path = Path("packages/site-validators/src/phase4-content-materialization.test.ts")
test = test_path.read_text(encoding="utf-8")
test = replace_once(
    test,
    '"<ul><li>項目A</li><li>項目B</li></ul>",',
    '"<ul><li><strong>項目A</strong>：説明</li><li>項目B</li></ul>",',
    "list fixture",
)
test = replace_once(
    test,
    'expect(markdown).toContain("- 項目A");',
    'expect(markdown).toContain("- **項目A**：説明");',
    "list assertion",
)
test_path.write_text(test, encoding="utf-8", newline="\n")
