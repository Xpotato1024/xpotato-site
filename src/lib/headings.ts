interface Heading {
  depth: number;
  slug: string;
  text: string;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function baseSlugify(value: string) {
  return stripTags(value)
    .toLowerCase()
    .replace(/[\"'`]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createUniqueSlug(baseSlug: string, seen: Map<string, number>) {
  const normalizedBase = baseSlug || "section";
  const count = seen.get(normalizedBase) ?? 0;
  seen.set(normalizedBase, count + 1);

  return count === 0 ? normalizedBase : `${normalizedBase}-${count + 1}`;
}

export function extractLegacyHeadings(body: string): Heading[] {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  const pattern = /<h([2-4])>(.*?)<\/h\1>/gims;

  for (const match of body.matchAll(pattern)) {
    const depth = Number(match[1]);
    const text = stripTags(match[2]);

    if (!text) {
      continue;
    }

    headings.push({
      depth,
      text,
      slug: createUniqueSlug(baseSlugify(text), seen)
    });
  }

  return headings;
}

export function addHeadingIdsToHtml(html: string) {
  const seen = new Map<string, number>();

  return html.replace(/<h([2-4])>(.*?)<\/h\1>/gims, (match, depth, inner) => {
    const text = stripTags(inner);

    if (!text) {
      return match;
    }

    const slug = createUniqueSlug(baseSlugify(text), seen);
    return `<h${depth} id="${slug}">${inner}</h${depth}>`;
  });
}
