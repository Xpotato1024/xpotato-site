// Real static template and CSS acceptance. Synthetic prose and image only.
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,mkdir,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {transform} from "@astrojs/compiler-rs";
import ts from "typescript";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
const siteRequire=createRequire(new URL("../../apps/site/package.json",import.meta.url));
const runtime=await import(pathToFileURL(siteRequire.resolve("astro/runtime/server/index.js")).href);
const {experimental_AstroContainer}=await import(pathToFileURL(siteRequire.resolve("astro/container")).href);
import {figureModulePropsSchema} from "../../packages/content-contracts/src/index.ts";
import {resolveMediaCredits,renderMediaCredits} from "../../apps/site/src/lib/media/media-credits.ts";
import {creditContentId,creditContext,creditRights} from "../../apps/site/src/lib/media/media-credits.test-fixtures.ts";
import {browserSession,loaded} from "../review/articles/article-concrete-browser.mjs";

const root=await mkdtemp(join(tmpdir(),"xpotato-credit-layout-"));
const outputArg=process.argv.find(arg=>arg.startsWith("--output=")),output=outputArg?resolve(outputArg.slice(9)):undefined;
let session;
try{
  if(output)await mkdir(output,{recursive:true});
  const attribution="図版：合成スタジオ。名称・図版は権利者のものです。掲載先との提携・承認を示しません。";
  const rights=[{...creditRights,attributionText:attribution.repeat(3),sourceUrl:"https://example.test/"+ "long-path-".repeat(30),
    licenseId:"Fixture license",licenseUrl:"https://example.test/LICENSE"}];
  const context={...creditContext,rights};
  const picture='<picture><img src="/fixture.svg" width="640" height="320" alt="合成図" loading="eager"></picture>';
  const container=await experimental_AstroContainer.create();
  const render=async(name,props)=>{
    const source=await readFile("apps/site/src/components/content/"+name+".astro","utf8");
    const compiled=transform(source,{filename:name+".astro",resultScopedSlot:true});
    const code=ts.transpileModule(compiled.code,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.CommonJS}}).outputText;
    const module={exports:{}};
    const require=id=>{
      if(id==="astro/runtime/server/index.js")return {...runtime,createMetadata:()=>({})};
      if(id==="./MediaPicture.astro")return {default:runtime.createComponent(()=>runtime.render`${runtime.markHTMLString(picture)}`)};
      if(id==="@xpotato/portable-content/media-picture")return {renderRegistryPicture:()=>picture};
      if(id==="../../lib/media/media-context.js")return {contentMediaContext:()=>context};
      if(id==="../../lib/media/media-credits.js")return {resolveMediaCredits,renderMediaCredits};
      if(id==="@xpotato/content-contracts")return {figureModulePropsSchema};
      throw Error("Unexpected fixture dependency "+id);
    };
    new Function("require","exports",code)(require,module.exports);
    return container.renderToString(module.exports.default,{props,locals:{xpotatoContentId:creditContentId}});
  };
  const hero=await render("MediaHero",{asset:"diagram",contentId:creditContentId});
  const figure=await render("Figure",{asset:"diagram",alt:"元の代替説明",title:"元の図題",caption:"元の説明",width:"compact",credit:rights[0].attributionText,sourceUrl:rights[0].sourceUrl});
  const gallery=await render("Figure",{asset:"diagram",alt:"合成図",title:"別の図題",width:"compact"});
  const css=(await Promise.all(["content.css","article-structure.css","article-modules.css","media-credit.css"].map(name=>readFile("apps/site/src/styles/"+name,"utf8")))).join("\n");
  await writeFile(join(root,"fixture.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#c7becf"/></svg>');
  await writeFile(join(root,"index.html"),'<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic media credit layout</title><style>:root{--text-primary:#28222e;--text-muted:#5d5663;--accent:#76538e;--border-divider:#ccc}*{box-sizing:border-box}body{margin:16px}.content-page{max-width:832px;margin:auto}figure{margin-inline:0}'+css+'</style><main class="content-page"><article>'+hero+'<div class="prose">'+figure+'<section class="article-diagrams" aria-label="合成ギャラリー">'+gallery+gallery+'</section></div></article></main>');
  session=await browserSession(root,"/index.html");
  const cases=[];
  for(const width of [320,390,1440]){
    await session.send("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:false});
    await loaded(session,".media-credit");
    const state=await session.js('(()=>{const captions=[...document.querySelectorAll("figcaption")],credits=[...document.querySelectorAll(".media-credit")],links=[...document.querySelectorAll(".media-credit a")];return {overflow:document.documentElement.scrollWidth>innerWidth,captions:captions.length,credits:credits.length,links:links.length,clipped:credits.some(e=>e.scrollWidth>e.clientWidth+1),nested:!!document.querySelector("figcaption figcaption,a a"),scriptCount:document.scripts.length,linkNames:links.map(a=>a.textContent),imageOrder:captions.every(c=>c.getBoundingClientRect().top>=c.closest("figure").querySelector("img").getBoundingClientRect().bottom),focusable:links.every(a=>{a.focus();return document.activeElement===a&&getComputedStyle(a).outlineStyle!=="none"})}})()');
    assert.equal(state.overflow,false);assert.equal(state.clipped,false);assert.equal(state.nested,false);
    assert.equal(state.captions,4);assert.equal(state.credits,4);assert.equal(state.links,8);
    assert.equal(state.scriptCount,0);assert.equal(state.imageOrder,true);assert.equal(state.focusable,true);
    assert(state.linkNames.every(name=>name==="出典"||name==="Fixture license（利用条件）"));
    cases.push({width,...state});
    if(output){const shot=await session.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});await writeFile(join(output,"media-credit-"+width+".png"),Buffer.from(shot.data,"base64"));}
  }
  const report={status:"PASS",cases,scope:"Synthetic real Astro templates, local static CSS, no external media or article changes"};
  if(output)await writeFile(join(output,"media-credit-layout.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
}finally{await session?.close();await rm(root,{recursive:true,force:true});}
