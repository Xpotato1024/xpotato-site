// Fixed dictionary and opt-in public host labels; no caller text argument.
import {fontText} from './font-text.mjs';
export function prepareFixedFonts(element,finish){
 let active=true,settled=false;
 const complete=ok=>{if(!active||settled)return;settled=true;clearTimeout(timer);finish(ok);};
 const timer=setTimeout(()=>complete(false),5000);
 Promise.resolve().then(()=>{
  if(!active)return;
  const host=element.closest?.('[data-interactive-module][data-bt-font-text]')?.getAttribute('data-bt-font-text')??'';
  const text=Object.values(fontText).join('')+'0123456789'+host;
  if(text.length>4096)throw Error('Fixed font text exceeds limit');
  if(!document.fonts?.load)throw Error('Font preparation unavailable');
  return document.fonts.load('1rem '+getComputedStyle(element).fontFamily,text);
 }).then(()=>complete(true),()=>complete(false));
 return()=>{active=false;clearTimeout(timer);};
}
