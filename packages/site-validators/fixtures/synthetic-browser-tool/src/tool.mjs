import { createElement as h, useEffect, useState, useRef } from "react";
import { convert } from "./core.mjs";
import {prepareFixedFonts} from './prepare-fonts.mjs';
import {fontText as uiText} from './font-text.mjs';

export default function Tool({instanceId, locale}) {
  const [ready, setReady] = useState(false), [draft, setDraft] = useState(""), [result, setResult] = useState("");
  const root=useRef(null),[fontError,setFontError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(() => {setReady(false);setFontError(false);return prepareFixedFonts(root.current,ok=>{setReady(ok);setFontError(!ok);});}, [attempt]);
  const inputId = instanceId + "-input";
  return h("section", {ref:root,className:"bt-synthetic-counter", "data-browser-tool":"", "data-tool-id":"synthetic-counter",
    "data-tool-state":ready ? "ready" : "loading", lang:locale},
    h("form", {onSubmit:event => {event.preventDefault();setResult(convert(draft));}},
      h("label", {htmlFor:inputId}, uiText.label),
      h("textarea", {id:inputId, value:draft, disabled:!ready, onChange:event=>setDraft(event.target.value)}),
      h("button", {type:"submit",disabled:!ready}, uiText.submit),
      h("button", {type:"button",disabled:!ready,onClick:()=>{setDraft("");setResult("");}}, uiText.reset)),
    fontError&&h('div',{role:'alert'},uiText.fontError,h('button',{type:'button',onClick:()=>setAttempt(n=>n+1)},uiText.retry)),
    h("output", {"aria-live":"polite"}, result));
}
