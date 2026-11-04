import {createElement as h,useEffect,useId,useRef,useState} from "react";
import {makeWorker} from "./loader.mjs";
import {prepareFixedFonts} from './prepare-fonts.mjs';
import {fontText as text} from './font-text.mjs';
export default function Tool(){
 const id=useId(),active=useRef(null),mounted=useRef(false),root=useRef(null);
 const [phase,setPhase]=useState("loading"),[input,setInput]=useState(""),[result,setResult]=useState("");
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{mounted.current=false;setPhase('loading');const cancel=prepareFixedFonts(root.current,ok=>{mounted.current=ok;setPhase(ok?'ready':'load-error');});const leave=()=>active.current?.cancel();addEventListener('pagehide',leave);return()=>{removeEventListener('pagehide',leave);cancel();mounted.current=false;active.current?.dispose();active.current=null;};},[attempt]);
 function start(event){
  event.preventDefault();if(active.current||!mounted.current)return;
  if(new TextEncoder().encode(input).length>4096){setResult(text.limit);return;}
  let owner;try{owner=makeWorker();}catch{setResult(text.busy);return;}let timer;
  const dispose=()=>{clearTimeout(timer);owner.dispose();if(active.current?.owner===owner)active.current=null;};
  const finish=(text)=>{if(active.current?.owner!==owner)return;dispose();if(mounted.current){setResult(text);setPhase("result");}};
  active.current={owner,dispose,cancel:()=>finish(text.cancelled)};setPhase("running");setResult("");
  owner.worker.onmessage=e=>{if(e.data&&Number.isInteger(e.data.count)&&e.data.count>=0&&e.data.count<=4096)finish(text.result+e.data.count);else finish(text.invalid);};
  owner.worker.onerror=()=>finish(text.workerError);
  timer=setTimeout(()=>finish(text.timeout),500);owner.worker.postMessage(input);
 }
 return h("section",{ref:root,className:"bt-synthetic-counter","data-bounded-tool":"","data-phase":phase},
  h("form",{onSubmit:start},h("label",{htmlFor:id},text.label),
   h("textarea",{id,value:input,disabled:phase==="running",onChange:e=>setInput(e.target.value)}),
   h("button",{type:"submit",disabled:phase!=="ready"&&phase!=="result"},text.submit),
   h("button",{type:"button",disabled:phase!=="running",onClick:()=>active.current?.cancel()},text.cancel)),
  phase==='load-error'&&h('div',{role:'alert'},text.fontError,h('button',{type:'button',onClick:()=>setAttempt(n=>n+1)},text.retry)),
  h("output",{"aria-live":"polite"},result));
}
