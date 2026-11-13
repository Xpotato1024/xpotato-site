// Shared by native article pages and private candidate builds. No external calls.
for (const host of document.querySelectorAll("[data-article-motion]")) {
  const view = host.querySelector("[data-motion-view]");
  const template = host.querySelector("template[data-motion-picture]");
  const button = host.querySelector("[data-motion-toggle]");
  if (!view || !(template instanceof HTMLTemplateElement) || !(button instanceof HTMLButtonElement)) continue;
  const poster = view.cloneNode(true);
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playing = false;
  const setPlaying = (next) => {
    playing = next;
    view.replaceChildren(...Array.from((next ? template.content : poster).childNodes, node => node.cloneNode(true)));
    button.setAttribute("aria-pressed", String(next));
    button.setAttribute("aria-label", next ? "動きを停止" : "動きを再生");
    button.title = next ? "停止" : "再生";
    host.dataset.playing = String(next);
  };
  button.hidden = false;
  button.addEventListener("click", () => setPlaying(!playing));
  preference.addEventListener("change", (event) => { if (event.matches) setPlaying(false); });
  if (!preference.matches) setPlaying(true);
}
