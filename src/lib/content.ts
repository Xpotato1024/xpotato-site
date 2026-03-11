import { getCollection } from "astro:content";

export async function getPublishedEntries<
  T extends "blog" | "notes" | "projects" | "pages"
>(collection: T) {
  const entries = await getCollection(collection, ({ data }) => !data.draft);

  return entries.sort(
    (left, right) =>
      new Date(right.data.pubDate).getTime() - new Date(left.data.pubDate).getTime()
  );
}
