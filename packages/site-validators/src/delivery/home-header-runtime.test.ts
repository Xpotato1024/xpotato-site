import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {inspectHomeHeaderMarkup,validateHomeHeaderSource,measureHomeHeaderRuntime,homeHeaderBudget} from './home-header-runtime.js';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const script='<script src="/scripts/home-header.js" defer></script>';
const markup='<body class="home-header-layout"><div class="header-band"><header class="site-header"></header></div>'+script+'</body>';
const source=readFileSync(new URL('../../../../apps/site/public/scripts/home-header.js',import.meta.url),'utf8');
describe('bounded homepage header presentation enhancement',()=>{
  it('requires the exact homepage body/header and single deferred classic script',()=>{
    expect(inspectHomeHeaderMarkup(markup,'/').script).toBe('/scripts/home-header.js');
    expect(inspectHomeHeaderMarkup('<body>About</body>','/about/').script).toBeUndefined();
    for(const html of [markup.replace(script,''),markup.replace(script,script+script),markup.replace(' defer',''),markup.replace(' defer',' async'),markup.replace(' defer',' defer type="module"'),markup.replace(' defer',' defer defer'),markup.replace('home-header-layout','other-layout'),markup.replace('site-header','other-header'),markup.replace('/scripts/home-header.js','/scripts/home-header.js?x=1'),markup.replace(' defer',' defer onload="x()"'),markup.replace('</script>','fetch("/")</script>')])expect(()=>inspectHomeHeaderMarkup(html,'/')).toThrow();
    for(const route of ['/about/','about/index.html','/search/','/tools/example/'])expect(()=>inspectHomeHeaderMarkup(markup,route)).toThrow();
  });
  it('validates reviewed source but forbids dependencies/network/storage/dynamic code',()=>{
    expect(()=>validateHomeHeaderSource(source)).not.toThrow();
    for(const extra of ['fetch("/")','window["fetch"]("/")','const f=fetch; f("/")','import("./x.js")','import x from "./x.js"','export * from "./x.js"','new WebSocket("/")','localStorage.getItem("x")','document.cookie','location.href="/"','eval("1")','new Function("1")','document.createElement("script")','x'.repeat(homeHeaderBudget.raw)])expect(()=>validateHomeHeaderSource(source+';'+extra)).toThrow();
  });
  it('measures its bounded assets separately and removes only its script',async()=>{
    const dist=await mkdtemp(join(tmpdir(),'home-header-budget-'));
    try{await mkdir(join(dist,'scripts'));await writeFile(join(dist,'scripts/home-header.js'),source);
      const measured=await measureHomeHeaderRuntime(dist,markup,'/');expect(measured.homeHeaderAssets).toHaveLength(1);expect(measured.homeHeaderAssets[0]!.bytes).toBe(Buffer.byteLength(source));expect(measured.htmlWithoutHomeHeader).not.toContain(script);expect(measured.htmlWithoutHomeHeader).toContain('home-header-layout');
      expect((await measureHomeHeaderRuntime(dist,'<body>About</body>','/about/')).homeHeaderAssets).toEqual([]);
    }finally{await rm(dist,{recursive:true,force:true});}
  });
});
