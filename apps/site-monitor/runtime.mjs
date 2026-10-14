export const LIMITS = Object.freeze({provider:29, public:16, kvRead:1, kvWrite:2, mail:1, total:49, body:1048576, jsonNodes:32768, jsonDepth:32, state:2048, runMs:120000, ioMs:10000});
export const REASONS = Object.freeze(['API_ACCESS_DENIED','API_UNAVAILABLE','API_TIMEOUT','API_JSON_INVALID','API_SHAPE_UNKNOWN','CREDENTIAL_UNUSABLE','CONFIG_IDENTITY','CONFIG_DEPLOYMENT','CONFIG_BINDINGS','CONFIG_SETTINGS','CONFIG_ENDPOINTS','CONFIG_DOMAIN','CONFIG_ROUTE','CONFIG_CHANGED_DURING_READ','PUBLIC_RESPONSE','PHOTO_RESPONSE','BUDGET_EXCEEDED']);
export class Fault extends Error {
  constructor(kind, reason) { super(reason); this.kind=kind; this.reason=reason; }
}
export const fail=(kind,reason)=>{throw new Fault(kind,reason);};
export const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export const utf8=value=>new TextEncoder().encode(value);
export const canonical=value=>JSON.stringify(sort(value));
function sort(value) {
  if(Array.isArray(value))return value.map(sort);
  if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));
  return value;
}
export const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
// Bounded JSON grammar; reject duplicate keys/non-finite numbers before use.
export function parseJson(text, maximum=LIMITS.body) {
  if(typeof text!=='string'||utf8(text).length>maximum)fail('UNKNOWN','API_JSON_INVALID');
  let at=0,nodes=0,strings=0;
  const bad=()=>fail('UNKNOWN','API_JSON_INVALID');
  const white=()=>{while(/[ \t\r\n]/.test(text[at]??'!'))at++;};
  const string=()=>{
    const start=at++;let escaped=false;
    for(;at<text.length;at++){
      const c=text[at];
      if(!escaped&&c==='"'){
        let value;try{value=JSON.parse(text.slice(start,++at));}catch{bad();}
        strings+=utf8(value).length;if(strings>maximum)bad();return value;
      }
      if(c==='\\'&&!escaped)escaped=true;else escaped=false;
    }bad();
  };
  const value=depth=>{
    if(++nodes>LIMITS.jsonNodes||depth>LIMITS.jsonDepth)bad();white();
    if(text[at]==='"')return string();
    if(text[at]==='{'){
      at++;white();const result=Object.create(null),keys=new Set();
      if(text[at]==='}'){at++;return result;}
      for(;;){white();if(text[at]!=='"')bad();const key=string();if(keys.has(key))bad();keys.add(key);
        white();if(text[at++]!==':')bad();result[key]=value(depth+1);white();
        const end=text[at++];if(end==='}')return result;if(end!==',')bad();
      }
    }
    if(text[at]==='['){
      at++;white();const result=[];if(text[at]===']'){at++;return result;}
      for(;;){result.push(value(depth+1));white();const end=text[at++];if(end===']')return result;if(end!==',')bad();}
    }
    for(const [token,result] of [['true',true],['false',false],['null',null]])if(text.startsWith(token,at)){at+=token.length;return result;}
    const number=/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;number.lastIndex=at;const match=number.exec(text);
    if(!match)bad();at=number.lastIndex;const result=Number(match[0]);if(!Number.isFinite(result))bad();return result;
  };
  const result=value(0);white();if(at!==text.length)bad();return result;
}
export function createBudget(clock) {
  const started=clock(),deadline=started+LIMITS.runMs,counts={provider:0,public:0,kvRead:0,kvWrite:0,mail:0};
  return {
    counts,started,deadline,
    expired(){return clock()>=deadline;},
    check(){if(clock()>=deadline)fail('UNKNOWN','BUDGET_EXCEEDED');},
    spend(type){this.check();if(counts[type]>=LIMITS[type]||Object.values(counts).reduce((n,x)=>n+x,0)>=LIMITS.total)fail('UNKNOWN','BUDGET_EXCEEDED');counts[type]++;},
    async wait(task,cancel=()=>{}) {
      this.check();let timer;const timeout=Math.min(LIMITS.ioMs,deadline-clock());
      try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>{cancel();reject(new Fault('UNKNOWN','API_TIMEOUT'));},timeout);})]);}
      finally{clearTimeout(timer);}
    }
  };
}
export async function readBytes(url,options,type,budget,fetchImpl) {
  budget.spend(type);const controller=new AbortController();let reader;
  try{
    return await budget.wait(async()=>{
      const response=await fetchImpl(url,{...options,method:'GET',redirect:'manual',signal:controller.signal});
      budget.check();
      if(type==='provider'&&response.status!==200){
        fail('UNKNOWN',[401,403].includes(response.status)?'API_ACCESS_DENIED':'API_UNAVAILABLE');
      }
      if(type==='public'&&response.status!==options.expectedStatus)fail('PUBLIC_FAILURE',options.photo?'PHOTO_RESPONSE':'PUBLIC_RESPONSE');
      if(!response.body?.getReader)fail('UNKNOWN','API_UNAVAILABLE');
      reader=response.body.getReader();const parts=[];let size=0;
      for(;;){const row=await reader.read();budget.check();if(controller.signal.aborted)fail('UNKNOWN','API_TIMEOUT');if(row.done)break;size+=row.value.byteLength;
        if(size>LIMITS.body)fail('UNKNOWN','BUDGET_EXCEEDED');parts.push(row.value);
      }
      const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
      return bytes;
    },()=>{controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}});
  }catch(error){if(error instanceof Fault)throw error;fail('UNKNOWN','API_UNAVAILABLE');}
  finally{controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}try{reader?.releaseLock();}catch{}}
}
