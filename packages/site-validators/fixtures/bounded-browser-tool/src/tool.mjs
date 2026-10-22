import {createElement as h,useEffect,useId,useRef,useState} from "react";
import {makeWorker} from "./loader.mjs";
export default function Tool(){
 const id=useId(),active=useRef(null),mounted=useRef(false);
 const [phase,setPhase]=useState("loading"),[input,setInput]=useState(""),[result,setResult]=useState("");
 useEffect(()=>{mounted.current=true;setPhase("ready");return()=>{mounted.current=false;active.current?.dispose();active.current=null;};},[]);
 function start(event){
  event.preventDefault();if(active.current||!mounted.current)return;
  if(new TextEncoder().encode(input).length>4096){setResult("入力上限");return;}
  let owner;try{owner=makeWorker();}catch{setResult("別の計算が終了してから実行してください。");return;}let timer;
  const dispose=()=>{clearTimeout(timer);owner.dispose();if(active.current?.owner===owner)active.current=null;};
  const finish=(text)=>{if(active.current?.owner!==owner)return;dispose();if(mounted.current){setResult(text);setPhase("result");}};
  active.current={owner,dispose,cancel:()=>finish("中止しました。")};setPhase("running");setResult("");
  owner.worker.onmessage=e=>{if(e.data&&Number.isInteger(e.data.count)&&e.data.count>=0&&e.data.count<=4096)finish("コードポイント数: "+e.data.count);else finish("結果検証失敗");};
  owner.worker.onerror=()=>finish("Worker失敗");
  timer=setTimeout(()=>finish("時間上限"),500);owner.worker.postMessage(input);
 }
 return h("section",{className:"bt-synthetic-counter","data-bounded-tool":"","data-phase":phase},
  h("form",{onSubmit:start},h("label",{htmlFor:id},"試験用文字列"),
   h("textarea",{id,value:input,disabled:phase==="running",onChange:e=>setInput(e.target.value)}),
   h("button",{type:"submit",disabled:phase==="loading"||phase==="running"},"計算"),
   h("button",{type:"button",disabled:phase!=="running",onClick:()=>active.current?.cancel()},"中止")),
  h("output",{"aria-live":"polite"},result));
}
