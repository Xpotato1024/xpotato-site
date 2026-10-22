import {FIXTURE_WORKER_SOURCE} from "./worker-source.mjs";
let occupied=false;
export function makeWorker(){
 if(occupied)throw Error("One computation per document");occupied=true;
 const url=URL.createObjectURL(new Blob([FIXTURE_WORKER_SOURCE],{type:"text/javascript"}));
 try{
  const worker=new Worker(url,{type:"module"});let closed=false;
  return {worker,dispose(){if(!closed){closed=true;worker.terminate();URL.revokeObjectURL(url);occupied=false;}}};
 }catch(e){URL.revokeObjectURL(url);occupied=false;throw e;}
}
