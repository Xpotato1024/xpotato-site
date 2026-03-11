#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import shutil
import tarfile
from urllib.parse import unquote
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import DefaultDict, Iterable

DEFAULT_SKIP_SLUGS = {
    "hello-world",
    "hello-world-this-is-essentials-theme",
    "its-time-to-say-hello-to-essentials-theme",
    "say-salut-to-the-most-advanced-theme",
    "create-fast-and-cool-websites-like-a-pro",
    "add-multiple-languages-to-your-site",
    "homepage-saas-elementor",
    "sample-page",
    "blog",
}

DEMO_HOSTS = (
    "essentials.pixfort.com",
    "startertemplatecloud.com",
)

SHORTCODE_COMPONENTS = {
    "prime_number": ("PrimeFactorizer", "../../components/app/PrimeFactorizer"),
}


@dataclass
class PostEntry:
    post_id: int
    slug: str
    post_type: str
    title: str
    content: str
    excerpt: str
    status: str
    published_at: str
    updated_at: str
    guid: str


def decode_escaped(character: str) -> str:
    mapping = {
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "'": "'",
        '"': '"',
        "\\": "\\",
        "0": "\0",
    }
    return mapping.get(character, character)


def parse_values_block(block: str) -> Iterable[list[str]]:
    index = 0
    length = len(block)

    while index < length:
        while index < length and block[index] not in "();":
            index += 1

        if index >= length or block[index] == ";":
            return

        if block[index] != "(":
            index += 1
            continue

        index += 1
        row: list[str] = []
        field: list[str] = []
        in_string = False
        escaped = False

        while index < length:
            character = block[index]

            if in_string:
                if escaped:
                    field.append(decode_escaped(character))
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == "'":
                    in_string = False
                else:
                    field.append(character)
            else:
                if character == "'":
                    in_string = True
                elif character == ",":
                    row.append("".join(field))
                    field = []
                elif character == ")":
                    row.append("".join(field))
                    yield row
                    index += 1
                    break
                else:
                    field.append(character)

            index += 1


def iter_insert_rows(sql_path: Path, table_name: str) -> Iterable[list[str]]:
    marker = f"INSERT INTO `{table_name}` VALUES"
    collecting = False
    buffer: list[str] = []

    with gzip.open(sql_path, "rt", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if line.startswith(marker):
                collecting = True
                buffer = []
                continue

            if not collecting:
                continue

            buffer.append(line)

            if line.rstrip().endswith(";"):
                yield from parse_values_block("".join(buffer))
                collecting = False
                buffer = []


def strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def summarize_text(*values: str) -> str:
    for value in values:
        if not value or value.upper() == "NULL":
            continue
        plain = strip_html(value)
        if plain:
            return plain[:155]
    return "Migrated from the legacy WordPress site."


def is_demo_content(post: PostEntry) -> bool:
    haystack = "\n".join([post.title, post.slug, post.content, post.guid]).lower()

    if post.slug in DEFAULT_SKIP_SLUGS:
        return True

    if post.post_type == "page" and (
        post.title.strip().upper() == "HOME" or re.fullmatch(r"\d+(?:-\d+)*", post.slug)
    ):
        return True

    return any(host in haystack for host in DEMO_HOSTS)


def normalize_slug(slug: str, post_id: int) -> str:
    slug = slug.strip("/")
    return slug or f"legacy-{post_id}"


def replace_upload_hosts(value: str) -> str:
    return re.sub(
        r"https?://(?:blog\.)?xpotato\.net/wp-content/uploads/",
        "/wp-content/uploads/",
        value,
    )


def transform_shortcodes(value: str) -> tuple[str, list[tuple[str, str]]]:
    imports: list[tuple[str, str]] = []
    transformed = value

    for shortcode, component in SHORTCODE_COMPONENTS.items():
        pattern = re.compile(
            rf"(<!-- wp:shortcode -->\s*)?\[?{re.escape(shortcode)}\]?(?:\s*<!-- /wp:shortcode -->)?",
            re.IGNORECASE,
        )
        if pattern.search(transformed):
            transformed = pattern.sub(f"<{component[0]} client:visible />", transformed)
            imports.append(component)

    return transformed, imports


def clean_content(value: str) -> tuple[str, list[tuple[str, str]]]:
    cleaned = value
    cleaned = re.sub(r"<!--\s*/?wp:[\s\S]*?-->", "", cleaned)
    cleaned = replace_upload_hosts(cleaned)
    cleaned = cleaned.replace('<div class="wp-block-jetpack-markdown">', "")
    if cleaned.strip().endswith("</div>"):
        cleaned = re.sub(r"\s*</div>\s*$", "", cleaned)
    cleaned, imports = transform_shortcodes(cleaned)
    cleaned = re.sub(r"<br(?<!/)>", "<br />", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<hr(?<!/)>", "<hr />", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<img([^>]*?)(?<!/)>", r"<img\1 />", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"<p>\s*(<\w+ client:visible\s*/>)(?:<br\s*/?>)?\s*</p>",
        r"\1",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"<p>\s*</p>", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip(), imports


def yaml_escape(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    escaped = escaped.replace("\n", " ")
    return f'"{escaped}"'


def dump_frontmatter(payload: dict[str, object]) -> str:
    lines = ["---"]

    for key, value in payload.items():
        if value is None:
            continue
        if isinstance(value, bool):
            lines.append(f"{key}: {'true' if value else 'false'}")
        elif isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        elif isinstance(value, str):
            lines.append(f"{key}: {yaml_escape(value)}")
        else:
            lines.append(f"{key}: {value}")

    lines.append("---")
    return "\n".join(lines)


def collect_upload_references(*values: str) -> set[str]:
    matches: set[str] = set()
    pattern = re.compile(r"(?:https?://[^\"' )]+)?/wp-content/uploads/([^\"' )]+)")

    for value in values:
        for match in pattern.findall(value):
            matches.add(match)

    return matches


def extract_uploads(media_archive: Path, upload_paths: set[str], public_dir: Path) -> None:
    if not upload_paths:
        return

    with tarfile.open(media_archive, "r:gz") as archive:
        for relative_path in sorted(upload_paths):
            member_name = f"wp-content/uploads/{relative_path}"
            try:
                member = archive.getmember(member_name)
            except KeyError:
                continue

            destination = public_dir / "wp-content" / "uploads" / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)

            with archive.extractfile(member) as source:
                if source is None:
                    continue
                with destination.open("wb") as target:
                    shutil.copyfileobj(source, target)


def build_taxonomy_maps(sql_path: Path):
    terms: dict[int, dict[str, str]] = {}
    term_taxonomy: dict[int, tuple[int, str]] = {}
    relationships: DefaultDict[int, list[int]] = defaultdict(list)

    for row in iter_insert_rows(sql_path, "wp_terms"):
        if len(row) >= 3:
            terms[int(row[0])] = {"name": row[1], "slug": unquote(row[2])}

    for row in iter_insert_rows(sql_path, "wp_term_taxonomy"):
        if len(row) >= 3:
            term_taxonomy[int(row[0])] = (int(row[1]), row[2])

    for row in iter_insert_rows(sql_path, "wp_term_relationships"):
        if len(row) >= 2:
            relationships[int(row[0])].append(int(row[1]))

    return terms, term_taxonomy, relationships


def build_postmeta_maps(sql_path: Path):
    thumbnail_by_post: dict[int, int] = {}
    attached_file_by_attachment: dict[int, str] = {}
    seo_description_by_post: dict[int, str] = {}

    for row in iter_insert_rows(sql_path, "wp_postmeta"):
        if len(row) < 4:
            continue

        post_id = int(row[1])
        key = row[2]
        value = row[3]

        if key == "_thumbnail_id" and value.isdigit():
            thumbnail_by_post[post_id] = int(value)
        elif key == "_wp_attached_file":
            attached_file_by_attachment[post_id] = value
        elif key in {"_yoast_wpseo_metadesc", "_aioseo_description"} and value:
            seo_description_by_post[post_id] = value

    return thumbnail_by_post, attached_file_by_attachment, seo_description_by_post


def load_posts(sql_path: Path) -> list[PostEntry]:
    posts: list[PostEntry] = []

    for row in iter_insert_rows(sql_path, "wp_posts"):
        if len(row) < 23:
            continue

        post_type = row[20]
        if post_type not in {"post", "page"}:
            continue

        posts.append(
            PostEntry(
                post_id=int(row[0]),
                slug=normalize_slug(row[11], int(row[0])),
                post_type=post_type,
                title=row[5],
                content=row[4],
                excerpt=row[6],
                status=row[7],
                published_at=row[2],
                updated_at=row[14],
                guid=row[18],
            )
        )

    return posts


def write_entry(
    destination: Path,
    frontmatter: dict[str, object],
    content: str,
    imports: list[tuple[str, str]],
) -> None:
    lines = [dump_frontmatter(frontmatter)]

    unique_imports = sorted(set(imports), key=lambda item: item[0])
    if unique_imports:
        lines.append("")
        for component_name, component_path in unique_imports:
            lines.append(f'import {component_name} from "{component_path}";')

    if content:
        lines.append("")
        if re.fullmatch(r"\s*<\w+ client:visible\s*/>\s*", content):
            lines.append(content.strip())
        else:
            unique_imports.append(("LegacyHtml", "../../components/ui/LegacyHtml.astro"))
            unique_imports = sorted(set(unique_imports), key=lambda item: item[0])
            lines = [dump_frontmatter(frontmatter), ""]
            for component_name, component_path in unique_imports:
                lines.append(f'import {component_name} from "{component_path}";')
            lines.append("")
            lines.append(f"<LegacyHtml html={{{json.dumps(content, ensure_ascii=False)}}} />")

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import WordPress content into Astro content collections.")
    parser.add_argument("--sql", required=True, type=Path, help="Path to wordpress-db.sql.gz")
    parser.add_argument("--media", type=Path, help="Path to wp-content.tar.gz")
    parser.add_argument("--site-root", required=True, type=Path, help="Astro site root")
    args = parser.parse_args()

    blog_dir = args.site_root / "src" / "content" / "blog"
    page_dir = args.site_root / "src" / "content" / "pages"
    public_dir = args.site_root / "public"
    report_dir = args.site_root / "tmp"

    terms, term_taxonomy, relationships = build_taxonomy_maps(args.sql)
    thumbnail_by_post, attached_file_by_attachment, seo_description_by_post = build_postmeta_maps(args.sql)
    posts = load_posts(args.sql)

    imported: list[dict[str, object]] = []
    skipped: list[dict[str, object]] = []
    upload_paths: set[str] = set()

    for post in posts:
        if post.status != "publish":
            skipped.append({"slug": post.slug, "title": post.title, "reason": f"status={post.status}"})
            continue

        if is_demo_content(post):
            skipped.append({"slug": post.slug, "title": post.title, "reason": "detected demo/default content"})
            continue

        tags: list[str] = []
        for taxonomy_id in relationships.get(post.post_id, []):
            term_id, taxonomy = term_taxonomy.get(taxonomy_id, (None, None))
            if term_id is None or taxonomy not in {"category", "post_tag"}:
                continue

            term = terms.get(term_id)
            if term:
                tags.append(term["slug"])

        hero_image = None
        thumbnail_id = thumbnail_by_post.get(post.post_id)
        if thumbnail_id is not None:
            relative_path = attached_file_by_attachment.get(thumbnail_id)
            if relative_path:
                hero_image = f"/wp-content/uploads/{relative_path}"
                upload_paths.add(relative_path)

        content, imports = clean_content(post.content)
        upload_paths.update(collect_upload_references(content, hero_image or ""))

        frontmatter = {
            "title": post.title,
            "description": summarize_text(seo_description_by_post.get(post.post_id, ""), post.excerpt, content),
            "pubDate": post.published_at.split(" ")[0],
            "updatedDate": post.updated_at.split(" ")[0] if post.updated_at else None,
            "tags": sorted(set(tags)),
            "draft": False,
            "heroImage": hero_image,
            "canonical": None,
            "ogImage": hero_image,
        }

        if post.post_type == "post":
            destination = blog_dir / f"{post.slug}.mdx"
        else:
            destination = page_dir / f"{post.slug}.mdx"
            frontmatter = {
                "title": post.title,
                "description": frontmatter["description"],
                "pubDate": frontmatter["pubDate"],
                "updatedDate": frontmatter["updatedDate"],
                "draft": False,
                "summary": frontmatter["description"],
            }

        write_entry(destination, frontmatter, content, imports)
        imported.append({"slug": post.slug, "title": post.title, "type": post.post_type})

    if args.media:
        extract_uploads(args.media, upload_paths, public_dir)

    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "wordpress-import-report.json"
    report_path.write_text(
        json.dumps(
            {
                "imported": imported,
                "skipped": skipped,
                "uploadCount": len(upload_paths),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Imported {len(imported)} entries.")
    print(f"Skipped {len(skipped)} entries.")
    print(f"Collected {len(upload_paths)} upload references.")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
