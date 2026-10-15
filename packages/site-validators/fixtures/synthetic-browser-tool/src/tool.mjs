import { createElement as h, useEffect, useState } from "react";
import { convert } from "./core.mjs";

export default function Tool({instanceId, locale}) {
  const [ready, setReady] = useState(false), [draft, setDraft] = useState(""), [result, setResult] = useState("");
  useEffect(() => { setReady(true); }, []);
  const inputId = instanceId + "-input";
  return h("section", {className:"bt-synthetic-counter", "data-browser-tool":"", "data-tool-id":"synthetic-counter",
    "data-tool-state":ready ? "ready" : "loading", lang:locale},
    h("form", {onSubmit:event => {event.preventDefault();setResult(convert(draft));}},
      h("label", {htmlFor:inputId}, "試験用文字列"),
      h("textarea", {id:inputId, value:draft, disabled:!ready, onChange:event=>setDraft(event.target.value)}),
      h("button", {type:"submit",disabled:!ready}, "計算"),
      h("button", {type:"button",disabled:!ready,onClick:()=>{setDraft("");setResult("");}}, "リセット")),
    h("output", {"aria-live":"polite"}, result));
}
