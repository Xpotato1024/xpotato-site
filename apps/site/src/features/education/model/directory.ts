import type { EducationMetadata } from "@xpotato/content-contracts";
import {
  selectWebIndexableCatalog,
  type DerivedCatalogEntry,
} from "@xpotato/portable-content/catalog";

export interface EducationEntry {
  contentId: string;
  title: string;
  description: string;
  route: string;
  education: EducationMetadata;
}

export interface EducationSubject {
  subject: string;
  entries: EducationEntry[];
}

export const deriveEducationDirectory = (
  catalog: readonly DerivedCatalogEntry[],
): EducationSubject[] => {
  const groups = new Map<string, EducationEntry[]>();
  for (const entry of selectWebIndexableCatalog(catalog)) {
    const { source } = entry;
    if (source.collection !== "blog" && source.collection !== "notes") {
      continue;
    }
    const education = source.data.education;
    if (!education?.subject.trim()) {
      continue;
    }
    const subject = education.subject.trim();
    const items = groups.get(subject) ?? [];
    items.push({
      contentId: entry.routeRecord.contentId,
      title: entry.discoveryRecord.title,
      description: entry.discoveryRecord.description,
      route: entry.routeRecord.route,
      education,
    });
    groups.set(subject, items);
  }
  return [...groups]
    .sort(([left], [right]) => left.localeCompare(right, "ja"))
    .map(([subject, entries]) => ({
      subject,
      entries: entries.sort((left, right) => left.title.localeCompare(right.title, "ja")),
    }));
};
