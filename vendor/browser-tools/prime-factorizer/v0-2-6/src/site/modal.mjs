// SPDX-License-Identifier: AGPL-3.0-only
// Native top-layer modality owns background inertness and keyboard containment.
export function createModal(dialog,{onClose=()=>{}}={}){
 const view=dialog.ownerDocument.defaultView;let active=false,disposed=false,invoker=null,position=null;
 const finish=(reason,focus=invoker)=>{if(!active)return;active=false;if(dialog.open)dialog.close();onClose(reason);if(!disposed){focus?.focus({preventScroll:true});if(position)view?.scrollTo?.({...position,behavior:'instant'});}invoker=position=null;};
 const cancel=e=>{e.preventDefault();finish('cancel');},closed=()=>{if(!dialog.open)finish('cancel');},backdropWheel=e=>{if(e.target===dialog)e.preventDefault();};
 const boundaryTab=e=>{if(!active||e.key!=='Tab')return;const targets=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(n=>n.getClientRects().length>0),index=targets.indexOf(dialog.ownerDocument.activeElement);if(!targets.length){e.preventDefault();return;}if(index<0||e.shiftKey&&index===0||!e.shiftKey&&index===targets.length-1){e.preventDefault();targets[e.shiftKey?targets.length-1:0].focus({preventScroll:true});}};
 dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);dialog.addEventListener('keydown',boundaryTab);dialog.addEventListener('wheel',backdropWheel,{passive:false});dialog.addEventListener('touchmove',backdropWheel,{passive:false});
 return{isOpen:()=>active,
  show(trigger,initialFocus){if(disposed||active||typeof dialog.showModal!=='function')return false;invoker=trigger;position={left:view?.scrollX??0,top:view?.scrollY??0};try{dialog.showModal();active=true;initialFocus?.focus({preventScroll:true});return true;}catch{invoker=position=null;return false;}},
  close:(reason='cancel',focus=invoker)=>finish(reason,focus),
  dispose(){if(disposed)return;disposed=true;finish('dispose',null);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);dialog.removeEventListener('keydown',boundaryTab);dialog.removeEventListener('wheel',backdropWheel);dialog.removeEventListener('touchmove',backdropWheel);}
 };
}
