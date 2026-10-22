import {createElement as h, useId, useState, useEffect} from "react";
import {convert} from "../core/convert.mjs";
export function Tool({instanceId, locale="ja-JP"}={}) {
  const unique=useId(), inputId=(instanceId || unique)+"-input";
  const [ready,setReady]=useState(false);useEffect(()=>{setReady(true);},[]);
  const [draft,setDraft]=useState(""), [result,setResult]=useState(""), [error,setError]=useState("");
  return h("section",{className:"bt-__TOOL_ID__",lang:locale,"data-browser-tool":"","data-tool-state":ready?"ready":"loading"},
    h("form",{onSubmit:event=>{event.preventDefault();try{setResult(convert(draft));setError("");}catch(e){setResult("");setError(e.message);}}},
      h("label",{htmlFor:inputId},__TITLE_JSON__),
      h("textarea",{id:inputId,value:draft,disabled:!ready,onChange:event=>setDraft(event.target.value),maxLength:__INPUT_BYTES__,"aria-describedby":inputId+"-error"}),
      h("div",{className:"bt-actions"},
        h("button",{type:"submit",disabled:!ready},"計算する"),
        h("button",{type:"button",disabled:!ready,onClick:()=>{setDraft("");setResult("");setError("");}},"リセット"))),
    h("p",{id:inputId+"-error",role:"alert"},error),
    h("output",{"aria-live":"polite"},result));
}
