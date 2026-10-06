import type MiniSearch from "minisearch";
import type { SearchDocument } from "@xpotato/content-contracts";
import { loadSearchIndex, searchSearchIndex } from "./runtime.js";

const form = document.querySelector<HTMLFormElement>("#search-form");
const input = document.querySelector<HTMLInputElement>("#search-query");
const headerInput = document.querySelector<HTMLInputElement>("#header-search-query");
const status = document.querySelector<HTMLElement>("#search-status");
const results = document.querySelector<HTMLOListElement>("#search-results");

if (form && input && status && results) {
  let composing = false;
  let request = 0;
  let index: MiniSearch<SearchDocument> | undefined;
  let loading: Promise<MiniSearch<SearchDocument>> | undefined;
  const load = () => {
    if (index) return Promise.resolve(index);
    loading ??= (async () => {
      const response = await fetch("/search/search-index.json");
      if (!response.ok) throw new Error(`search index: ${response.status}`);
      index = loadSearchIndex(await response.text());
      return index;
    })().finally(() => { loading = undefined; });
    return loading;
  };
  const syncUrl = (query: string) => {
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    if (url.href !== location.href) history.pushState(null, "", url);
    if (headerInput) headerInput.value = query;
  };
  const run = async (updateUrl = false) => {
    if (composing) return;
    const current = ++request;
    const query = input.value.trim();
    if (updateUrl) syncUrl(query);
    results.replaceChildren();
    if (!query) {
      status.textContent = "検索語を入力してください。";
      return;
    }
    status.textContent = "検索indexを読み込んでいます。";
    try {
      const matches = searchSearchIndex(await load(), query);
      // 古い非同期検索で、新しい検索・クリア・IME入力の状態を上書きしない。
      if (current !== request || composing || input.value.trim() !== query) return;
      status.textContent = matches.length ? `${matches.length}件` : "一致する結果はありません。";
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
      if (current === request && !composing && input.value.trim() === query) status.textContent = "検索indexを読み込めませんでした。";
    }
  };
  const restoreQuery = () => {
    composing = false;
    input.value = new URL(location.href).searchParams.get("q") ?? "";
    if (headerInput) headerInput.value = input.value;
    void run();
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); if (!composing) void run(true); });
  form.addEventListener("reset", () => { composing = false; ++request; queueMicrotask(() => { input.value = ""; void run(true); }); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (composing || event.isComposing || event.keyCode === 229)) event.preventDefault();
  });
  input.addEventListener("input", () => {
    ++request;
    if (composing) return;
    results.replaceChildren();
    if (!input.value.trim()) void run(true);
    else status.textContent = "検索ボタンで検索してください。";
  });
  input.addEventListener("compositionstart", () => { composing = true; ++request; });
  input.addEventListener("compositionend", () => { composing = false; void run(true); });
  window.addEventListener("popstate", restoreQuery);
  window.addEventListener("pageshow", (event) => { if (event.persisted) restoreQuery(); });
  restoreQuery();
}
