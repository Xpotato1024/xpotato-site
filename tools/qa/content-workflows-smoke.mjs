// Explicit, local-only integration smoke. Never used to make a release artifact.
import {execFileSync} from 'node:child_process';
import {mkdtemp,symlink,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const repository=fileURLToPath(new URL("../../",import.meta.url));
if(process.platform==='win32')throw Error('Run this local smoke in the Linux Node environment used by the producer');
const temporary=await mkdtemp(join(tmpdir(),'xpotato-workflow-smoke-')),workspace=join(temporary,'site');
const npm=process.env.npm_execpath;if(!npm||!isAbsolute(npm))throw Error('Run through npm run content:smoke');
const node=process.execPath,tsx=join(repository,'node_modules/tsx/dist/cli.mjs');
const {parse:parseYaml}=createRequire(join(repository,'apps/site/package.json'))('yaml');
let created=false;
const run=(args,cwd=workspace)=>execFileSync(node,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}});
try{
 execFileSync('git',['worktree','add','--detach',workspace,'HEAD'],{cwd:repository,stdio:'pipe'});created=true;
 await symlink(join(repository,'node_modules'),join(workspace,'node_modules'),'dir');
 await symlink(join(repository,'apps/site/node_modules'),join(workspace,'apps/site/node_modules'),'dir');
 // Share installed dependencies, but keep generated caches inside this worktree.
 // The homepage integration prepares its cache from verified, non-public site source inputs.
 const config=join(workspace,'apps/site/astro.config.mjs');
 const configured=(await readFile(config,'utf8')).replace('defineConfig({','defineConfig({\n  cacheDir: "./.astro-workflow-cache",').replace('vite: { plugins:','vite: { cacheDir: "./.vite-workflow-cache", plugins:');
 await writeFile(config,configured);
 const job=JSON.parse(run([tsx,'tools/authoring/site.ts','article','init','--title','ワークフローの検証用記事','--description','公開しない合成下書き','--category','software','--pub-date','2026-11-02','--reader-outcome','private draftが公開されないことを確認する']));
 const marker='SYNTHETIC_DRAFT_NOT_FOR_PUBLICATION_9238f1';
 const searchFixture=await readFile(join(repository,'tests/fixtures/search/article.mdx'),'utf8');
 const searchFixtureId='38f4cc36-81fb-4d7c-8063-686eb8000352';
 await writeFile(join(workspace,'apps/site/src/content/blog/search-fixture.mdx'),searchFixture);
 const working=await readFile(job.workingPath,'utf8');
 assert.ok(working.includes('## 読者の疑問'));
 // This is loader-isolation fixture data, not an Article Job export. Private
 // YAML 1.2 dates must remain strings in Astro's YAML frontmatter parser too.
 const parts=/^---\r?\n([\s\S]+?)\r?\n---([\s\S]*)$/u.exec(working);assert.ok(parts);
 await writeFile(join(workspace,'apps/site/src/content/blog/workflow-smoke.mdx'),'---\n'+JSON.stringify(parseYaml(parts[1]),null,2)+'\n---\n'+parts[2]+'\n'+marker+'\n');
 const page=JSON.parse(run([tsx,'tools/authoring/content.ts','page','create','--slug','workflow-smoke-page','--title','検証用固定ページ','--description','公開しない固定ページ']));
 const tool='---\nid: 12345678-1234-4234-8234-123456789012\ntitle: 検証用ツール\ndescription: 公開しないツール下書き\npubDate: "2026-11-02"\ncategory: calculation\ntags: [math]\ndraft: true\n---\n\n'+marker+'\n';
 await writeFile(join(workspace,'apps/site/src/content/tools/workflow-smoke.mdx'),tool);
 const css=join(workspace,'apps/site/src/styles/global.css');
 await writeFile(css,(await readFile(css,'utf8'))+'\nbody { --workflow-style-proof: local-smoke; }\n');
 run([npm,'run','build']);run([npm,'run','publication:check']);
 const dist=join(workspace,'apps/site/dist'),manifest=JSON.parse(await readFile(join(dist,'_publication.json'),'utf8'));
 assert.ok(!manifest.routes.includes(job.route));assert.ok(!manifest.routes.includes(page.route));assert.ok(!manifest.routes.includes('/tools/workflow-smoke/'));
 let styleChanged=false;
 for(const path of await readdir(dist,{recursive:true})){
  if(!/\.(?:html|xml|json|css|js)$/.test(path))continue;
  const body=await readFile(join(dist,path),'utf8');assert.ok(!body.includes(marker),'Draft leaked into '+path);
  assert.ok(!body.includes(searchFixtureId),'Search fixture leaked into '+path);
  if(path.endsWith('.css')&&body.includes('--workflow-style-proof:'))styleChanged=true;
 }
 assert.ok(styleChanged,'Source CSS edit must reach actual Astro CSS output');
 const pageFile=join(workspace,page.file);await writeFile(pageFile,(await readFile(pageFile,'utf8')).replace('draft: true','draft: false'));
 run([npm,'run','build']);run([npm,'run','publication:check']);
 const published=JSON.parse(await readFile(join(dist,'_publication.json'),'utf8'));
 assert.ok(published.routes.includes(page.route));assert.ok(published.targets.some(t=>t.path===page.route));
 assert.ok((await readFile(join(dist,'workflow-smoke-page/index.html'),'utf8')).includes('検証用固定ページ'));
 console.log(JSON.stringify({status:'LOCAL_SYNTHETIC_SMOKE_PASS',privateArticleTemplate:true,draftArticleToolPageExcluded:true,styleReachedAstroOutput:true,fixedPageReachedRouteAndManifest:true,
  toolSourceInstallation:'covered separately by browser-tool-installation.test.ts',providerCalls:0,deploys:0,productionEligible:false}));
}finally{
 // Only remove the fresh operation-owned worktree under the system temp root.
 const within=relative(resolve(tmpdir()),resolve(workspace));
 if(created&&within&&!within.startsWith('..')&&!isAbsolute(within))execFileSync('git',['worktree','remove','--force',workspace],{cwd:repository,stdio:'pipe'});
}
