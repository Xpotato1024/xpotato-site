// One small progressive enhancement, loaded only by pages with rendered code blocks.
const busy = new WeakSet();
const resetTimers = new WeakMap();
for (const button of document.querySelectorAll(".code-copy-button")) button.hidden = false;

function legacyCopy(text) {
  const previousFocus = document.activeElement;
  const buffer = document.createElement("textarea");
  buffer.className = "code-copy-buffer";
  buffer.value = text;
  buffer.readOnly = true;
  document.body.append(buffer);
  try {
    buffer.focus({ preventScroll: true });
    buffer.select();
    buffer.setSelectionRange(0, text.length);
    return document.execCommand("copy") === true;
  } finally {
    buffer.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

document.addEventListener("click", async event => {
  const button = event.target instanceof Element ? event.target.closest(".code-copy-button") : null;
  if (!button || busy.has(button)) return;
  const block = button.closest("[data-code-block]");
  const code = block?.querySelector("pre code");
  const status = block?.querySelector(".code-copy-status");
  const tooltip = button.querySelector(".code-copy-tooltip");
  const feedback = block?.querySelector(".code-copy-feedback");
  if (!code || !status || !tooltip || !feedback) return;
  clearTimeout(resetTimers.get(button));
  button.dataset.state = "idle";
  feedback.hidden = true;
  feedback.textContent = "";
  busy.add(button);
  button.setAttribute("aria-busy", "true");
  status.textContent = "コピーしています…";
  tooltip.textContent = "コピーしています…";
  let copied = false;
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(code.textContent); copied = true; }
      catch { copied = legacyCopy(code.textContent); }
    } else {
      copied = legacyCopy(code.textContent);
    }
  } catch { copied = false; }
  finally { busy.delete(button); button.removeAttribute("aria-busy"); }
  status.textContent = copied
    ? "コピーしました。"
    : "コピーできませんでした。コードを選択してコピーしてください。";
  button.dataset.state = copied ? "success" : "error";
  tooltip.textContent = copied ? "コピーしました" : "コピーできませんでした";
  if (copied) {
    resetTimers.set(button, setTimeout(() => {
      button.dataset.state = "idle";
      tooltip.textContent = "コードをコピー";
      status.textContent = "";
      resetTimers.delete(button);
    }, 2000));
  } else {
    feedback.textContent = "コピーできませんでした。コードを選択してコピーしてください。";
    feedback.hidden = false;
  }
});
