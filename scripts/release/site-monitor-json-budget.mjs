// Hash coverage is not semantic approval. Only bounded, ordinary JSON can enter
// the canonical hash; never execute getters or silently omit non-JSON data.
export function boundedMonitorJson(value){
 let nodes=0,bytes=0;const ancestors=new Set();
 function visit(v,depth){
  if(++nodes>32768||depth>32)return false;
  if(v===null||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(typeof v==='string'){bytes+=Buffer.byteLength(v,'utf8');return bytes<=1048576;}
  if(typeof v!=='object'||ancestors.has(v))return false;
  const array=Array.isArray(v);
  if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))return false;
  const keys=Reflect.ownKeys(v);
  if(array&&(!Number.isSafeInteger(v.length)||v.length>32768||keys.length!==v.length+1))return false;
  ancestors.add(v);
  for(const key of keys){
   if(array&&key==='length')continue;
   const d=Object.getOwnPropertyDescriptor(v,key);
   if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value')||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=v.length)){ancestors.delete(v);return false;}
   bytes+=Buffer.byteLength(key,'utf8');
   if(bytes>1048576||!visit(d.value,depth+1)){ancestors.delete(v);return false;}
  }
  ancestors.delete(v);return true;
 }
 return visit(value,0);
}
