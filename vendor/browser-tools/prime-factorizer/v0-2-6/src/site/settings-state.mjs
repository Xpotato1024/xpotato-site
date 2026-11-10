// SPDX-License-Identifier: AGPL-3.0-only
import {selectSitePlan} from './policy.mjs';
export function createSettingsState(hints={}){
 const defaults=engine=>({engine,mode:engine==='wide'?'manual':'auto',workers:engine==='wide'?String(Math.min(5,Math.max(1,(hints.hardwareConcurrency??2)-1))):'1',memory:engine==='wide'?'1536':'128',time:engine==='standard'?'1000':'60000'});
 let applied=defaults('standard'),remembered=new Map(),draft=null,temporary=null;
 const effective=(v=applied)=>({mode:v.engine==='standard'?'auto':v.mode,...(v.engine!=='standard'&&v.mode==='manual'?{workers:Number(v.workers),memoryMiB:Number(v.memory)}:{}),timeBudgetMs:Number(v.time),...(v.engine==='wide'?{outstandingSlots:8}:{})});
 const validateDraft=()=>{if(!draft)throw Error('Settings dialog is closed');return selectSitePlan(draft.engine,effective(draft),hints);};
 return{applied:()=>({...applied}),draft:()=>({...draft??applied}),effective,plan:()=>selectSitePlan(applied.engine,effective(),hints),validateDraft,
  begin(){draft={...applied};temporary=new Map(remembered);return {...draft};},
  edit(key,value){if(!draft||!['engine','mode','workers','memory','time'].includes(key))throw Error('Settings draft required');if(key==='engine'){if(!['standard','optimized','wide'].includes(value))throw Error('Named engine required');temporary.set(draft.engine,{...draft});draft={...temporary.get(value)??defaults(value)};}else draft[key]=String(value);return {...draft};},
  apply(){const plan=validateDraft();draft.time=String(plan.timeBudgetMs);temporary.set(draft.engine,{...draft});applied={...draft};remembered=temporary;draft=temporary=null;return {...applied};},
  cancel(){draft=temporary=null;}
 };
}
