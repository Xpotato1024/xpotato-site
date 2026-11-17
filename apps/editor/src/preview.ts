import { renderDraftMarkdown } from "@xpotato/portable-content/draft";
import { parseDraft } from "@xpotato/editor-core/draft";
export async function previewDocument(source: string) {
  const { data, body } = parseDraft(source);
  const rendered = await renderDraftMarkdown(body);
  return { title: data.title, description: data.description, ...rendered };
}
