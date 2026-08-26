import MiniSearch from "minisearch";
import type { SearchDocument } from "@xpotato/content-contracts";
import { miniSearchOptions } from "./config.js";

const form = document.querySelector<HTMLFormElement>("#search-form");
const input = document.querySelector<HTMLInputElement>("#search-query");
const status = document.querySelector<HTMLElement>("#search-status");
const results = document.querySelector<HTMLOListElement>("#search-results");

if (form && input && status && results) {
  let composing = false;
  let index: MiniSearch<SearchDocument> | undefined;
  const load = async () => {
    if (index) return index;
    status.textContent = "検索indexを読み込んでいます。";
    const response = await fetch("/search/search-index.json");
    if (!response.ok) throw new Error(`search index: ${response.status}`);
    index = MiniSearch.loadJSON<SearchDocument>(await response.text(), miniSearchOptions);
    return index;
  };
  const run = async () => {
    if (composing) return;
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) {
      status.textContent = "検索語を入力してください。";
      return;
    }
    try {
      const matches = (await load()).search(query, { combineWith: "AND", fuzzy: false });
      status.textContent = `${matches.length}件`;
      for (const match of matches) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = String(match.route);
        link.textContent = String(match.title);
        const description = document.createElement("p");
        description.textContent = String(match.description);
        item.append(link, description);
        results.append(item);
      }
    } catch {
      status.textContent = "検索indexを読み込めませんでした。";
    }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); void run(); });
  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; void run(); });
}
