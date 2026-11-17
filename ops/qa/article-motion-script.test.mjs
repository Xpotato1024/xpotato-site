import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
const source=await readFile(new URL("../../apps/site/public/scripts/article-motion.js",import.meta.url),"utf8");
function fixture({reduced=false,present=true}={}){
 const node=kind=>({kind,cloneNode(){return node(kind);}});
 const view={childNodes:[node("poster")],cloneNode(){return {childNodes:[node("poster")]};},replaceChildren(...children){this.childNodes=children;}};
 class Template{content={childNodes:[node("motion")]};}
 class Button{hidden=true;attributes=new Map();events=new Map();setAttribute(key,value){this.attributes.set(key,value);}addEventListener(name,callback){this.events.set(name,callback);}}
 const template=new Template(),button=new Button(),host={dataset:{playing:"false"},querySelector:s=>({"[data-motion-view]":view,"template[data-motion-picture]":template,"[data-motion-toggle]":button}[s])};
 const preference={matches:reduced,events:new Map(),addEventListener(name,callback){this.events.set(name,callback);}};
 vm.runInNewContext(source,{document:{querySelectorAll:()=>present?[host]:[]},window:{matchMedia:()=>preference},HTMLTemplateElement:Template,HTMLButtonElement:Button});
 return {host,view,button,preference,click:()=>button.events.get("click")(),change:matches=>preference.events.get("change")({matches})};
}
test("normal playback can pause to its poster and resume from a fresh motion picture",()=>{
 const f=fixture();assert.equal(f.host.dataset.playing,"true");assert.equal(f.button.hidden,false);
 assert.equal(f.button.attributes.get("aria-label"),"動きを停止");const first=f.view.childNodes[0];assert.equal(first.kind,"motion");
 f.click();assert.equal(f.host.dataset.playing,"false");assert.equal(f.view.childNodes[0].kind,"poster");
 assert.equal(f.button.attributes.get("aria-pressed"),"false");assert.equal(f.button.attributes.get("aria-label"),"動きを再生");
 f.click();assert.equal(f.view.childNodes[0].kind,"motion");assert.notEqual(f.view.childNodes[0],first);
});
test("reduced motion preserves the initial poster, permits explicit playback and stops when preference changes",()=>{
 const f=fixture({reduced:true});assert.equal(f.host.dataset.playing,"false");assert.equal(f.view.childNodes[0].kind,"poster");
 f.click();assert.equal(f.host.dataset.playing,"true");f.change(true);assert.equal(f.host.dataset.playing,"false");
 f.change(false);assert.equal(f.host.dataset.playing,"false");
});
test("pages without motion controls are inert",()=>{
 const f=fixture({present:false});assert.equal(f.button.hidden,true);assert.equal(f.button.events.size,0);assert.equal(f.preference.events.size,0);
});
