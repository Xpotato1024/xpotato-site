import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export async function getPublishedEntries<
  T extends "blog" | "notes" | "projects" | "pages"
>(collection: T) {
  const entries = await getCollection(collection, ({ data }) => !data.draft);

  return entries.sort(
    (left, right) =>
      new Date(right.data.pubDate).getTime() - new Date(left.data.pubDate).getTime()
  );
}

function scoreRelatedPost(
  currentPost: CollectionEntry<"blog">,
  candidate: CollectionEntry<"blog">
) {
  let score = 0;

  const currentTags = new Set(currentPost.data.tags);
  const sharedTags = candidate.data.tags.filter((tag) => currentTags.has(tag)).length;

  score += sharedTags * 4;

  if (currentPost.data.category && currentPost.data.category === candidate.data.category) {
    score += 2;
  }

  return score;
}

export async function getRelatedBlogPosts(
  currentPost: CollectionEntry<"blog">,
  limit = 3
) {
  const posts = await getPublishedEntries("blog");
  const candidates = posts.filter((post) => post.slug !== currentPost.slug);
  const ranked = candidates
    .map((post) => ({
      post,
      score: scoreRelatedPost(currentPost, post)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.post.data.pubDate).getTime() - new Date(left.post.data.pubDate).getTime()
      );
    });

  const preferred = ranked.filter((item) => item.score > 0).map((item) => item.post);
  const fallback = ranked.filter((item) => item.score === 0).map((item) => item.post);

  return [...preferred, ...fallback].slice(0, limit);
}
