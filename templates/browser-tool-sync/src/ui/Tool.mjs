import {createElement as h, useId, useState, useEffect, useRef} from "react";
import {convert} from "../core/convert.mjs";
import {prepareFixedFonts} from './prepare-fonts.mjs';
import {fontText as uiText} from './font-text.mjs';
export function Tool({instanceId, locale="ja-JP"}={}) {
  const unique=useId(), inputId=(instanceId || unique)+"-input";
  const root=useRef(null),[ready,setReady]=useState(false),[fontError,setFontError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{setReady(false);setFontError(false);return prepareFixedFonts(root.current,ok=>{setReady(ok);setFontError(!ok);});},[attempt]);
  const [draft,setDraft]=useState(""), [result,setResult]=useState(""), [error,setError]=useState("");
  return h("section",{ref:root,className:"bt-__TOOL_ID__",lang:locale,"data-browser-tool":"","data-tool-state":fontError?"load-error":ready?"ready":"loading"},
    h("form",{onSubmit:event=>{event.preventDefault();try{setResult(convert(draft));setError("");}catch(e){setResult("");setError(e.message);}}},
      h("label",{htmlFor:inputId},uiText.label),
      h("textarea",{id:inputId,value:draft,disabled:!ready,onChange:event=>setDraft(event.target.value),maxLength:__INPUT_BYTES__,"aria-describedby":inputId+"-error"}),
      h("div",{className:"bt-actions"},
        h("button",{type:"submit",disabled:!ready},uiText.submit),
        h("button",{type:"button",disabled:!ready,onClick:()=>{setDraft("");setResult("");setError("");}},uiText.reset))),
    fontError&&h("div",{role:"alert"},uiText.fontError,h("button",{type:"button",onClick:()=>setAttempt(n=>n+1)},uiText.retry)),
    h("p",{id:inputId+"-error",role:"alert"},error),
    h("output",{"aria-live":"polite"},result));
}
