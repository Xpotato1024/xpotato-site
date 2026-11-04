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
 const memo=JSON.parse(run([tsx,'tools/authoring/content.ts','note','create','--slug','workflow-smoke-memo','--title','合成・日常のメモ','--description','短い抜粋の検証','--pub-date','2026-11-04','--feed','include']));
 const memoFile=join(workspace,memo.file),memoDraft=await readFile(memoFile,'utf8');
 assert.match(memoDraft,/subject: "everyday"/u);assert.match(memoDraft,/feed: true/u);assert.ok(!memoDraft.includes('dot のひとこと'));
 const authorText='SYNTHETIC_MEMO_AUTHOR_913b',commentText='SYNTHETIC_DOT_COMMENT_47ba';
 // Both are explicitly synthetic. The optional comment uses the existing semantic module.
 await writeFile(memoFile,memoDraft+'\n'+authorText+'\n\n<Callout kind="note" title="dot のひとこと（AIコメント）">\n\n'+commentText+'\n\n</Callout>\n'+marker+'\n');
 const noindexMemo=JSON.parse(run([tsx,'tools/authoring/content.ts','note','create','--slug','workflow-noindex-memo','--title','合成・非索引メモ','--description','非索引状態の検証','--pub-date','2026-11-03','--feed','include']));
 const noindexFile=join(workspace,noindexMemo.file);
 await writeFile(noindexFile,(await readFile(noindexFile,'utf8')).replace('draft: true','draft: false\nseo:\n  noindex: true'));
 const tool='---\nid: 12345678-1234-4234-8234-123456789012\ntitle: 検証用ツール\ndescription: 公開しないツール下書き\npubDate: "2026-11-02"\ncategory: calculation\ntags: [math]\ndraft: true\n---\n\n'+marker+'\n';
 await writeFile(join(workspace,'apps/site/src/content/tools/workflow-smoke.mdx'),tool);
 const css=join(workspace,'apps/site/src/styles/global.css');
 await writeFile(css,(await readFile(css,'utf8'))+'\nbody { --workflow-style-proof: local-smoke; }\n');
 run([npm,'run','build']);run([npm,'run','publication:check']);
 const dist=join(workspace,'apps/site/dist'),manifest=JSON.parse(await readFile(join(dist,'_publication.json'),'utf8'));
 assert.ok(!manifest.routes.includes(job.route));assert.ok(!manifest.routes.includes(page.route));assert.ok(!manifest.routes.includes(memo.route));assert.ok(!manifest.routes.includes('/tools/workflow-smoke/'));
 assert.ok(manifest.routes.includes(noindexMemo.route));
 let styleChanged=false;
 for(const path of await readdir(dist,{recursive:true})){
  if(!/\.(?:html|xml|json|css|js)$/.test(path))continue;
  const body=await readFile(join(dist,path),'utf8');assert.ok(!body.includes(marker),'Draft leaked into '+path);
  assert.ok(!body.includes(searchFixtureId),'Search fixture leaked into '+path);
  if(path.endsWith('.css')&&body.includes('--workflow-style-proof:'))styleChanged=true;
 }
 assert.ok(styleChanged,'Source CSS edit must reach actual Astro CSS output');
 const pageFile=join(workspace,page.file);await writeFile(pageFile,(await readFile(pageFile,'utf8')).replace('draft: true','draft: false'));
 await writeFile(memoFile,(await readFile(memoFile,'utf8')).replace('draft: true','draft: false').replace(marker,''));
 const bareMemo=JSON.parse(run([tsx,'tools/authoring/content.ts','note','create','--slug','workflow-bare-memo','--title','合成・コメントなし','--description','本文だけでも成立するメモ','--pub-date','2026-11-02']));
 assert.equal(bareMemo.feed,false);
 const bareFile=join(workspace,bareMemo.file);await writeFile(bareFile,(await readFile(bareFile,'utf8')).replace('draft: true','draft: false'));
 run([npm,'run','build']);run([npm,'run','publication:check']);
 const published=JSON.parse(await readFile(join(dist,'_publication.json'),'utf8'));
 assert.ok(published.routes.includes(page.route));assert.ok(published.targets.some(t=>t.path===page.route));
 assert.ok((await readFile(join(dist,'workflow-smoke-page/index.html'),'utf8')).includes('検証用固定ページ'));
 assert.ok(published.routes.includes(memo.route));assert.ok(published.targets.some(t=>t.path===memo.route));
 assert.ok(published.routes.includes(bareMemo.route));
 const memoHtml=await readFile(join(dist,'notes/workflow-smoke-memo/index.html'),'utf8');
 assert.ok(memoHtml.includes(authorText));assert.match(memoHtml,/class="article-callout" data-kind="note"/u);assert.ok(memoHtml.includes('dot のひとこと（AIコメント）'));assert.ok(memoHtml.includes(commentText));
 assert.ok(!memoHtml.includes('<astro-island'));assert.ok(!memoHtml.includes('article-hero'));
 const bareHtml=await readFile(join(dist,'notes/workflow-bare-memo/index.html'),'utf8');assert.ok(!bareHtml.includes('dot のひとこと'));assert.ok(!bareHtml.includes('<astro-island'));
 const archive=await readFile(join(dist,'notes/index.html'),'utf8');assert.ok(archive.includes(memo.route));assert.ok(archive.includes('短い抜粋の検証'));assert.ok(archive.includes('メモ'));assert.ok(!archive.includes(noindexMemo.route));
 const rss=await readFile(join(dist,'rss.xml'),'utf8');assert.ok(rss.includes(memo.route));assert.ok(!rss.includes(noindexMemo.route));assert.ok(!rss.includes(bareMemo.route));
 const sitemap=await readFile(join(dist,'sitemap-0.xml'),'utf8');assert.ok(sitemap.includes(memo.route));assert.ok(sitemap.includes(bareMemo.route));assert.ok(!sitemap.includes(noindexMemo.route));
 const index=await readFile(join(dist,'search/search-index.json'),'utf8');assert.ok(index.includes(memo.contentId));assert.ok(index.includes(bareMemo.contentId));assert.ok(!index.includes(noindexMemo.contentId));
 // Confirm the noindex fixture and historical note keep their exact source bytes.
 for(const name of ['infrastructure-foundation.mdx','wordpress-migration-playbook.mdx'])assert.equal(await readFile(join(workspace,'apps/site/src/content/notes',name),'utf8'),await readFile(join(repository,'apps/site/src/content/notes',name),'utf8'));
 const evidence=process.env.XPOTATO_CONTENT_SMOKE_EVIDENCE;
 if(evidence){
  assert.ok(isAbsolute(evidence));
  // Optional local evidence copy, never a production artifact.
  const {cp,mkdir}=await import('node:fs/promises');await mkdir(evidence,{recursive:true});await cp(dist,join(evidence,'dist'),{recursive:true,errorOnExist:true,force:false});
 }
 console.log(JSON.stringify({status:'LOCAL_SYNTHETIC_SMOKE_PASS',privateArticleTemplate:true,draftArticleToolPageMemoExcluded:true,memoWithAndWithoutComment:true,memoUsesSharedDiscoveryAndManifest:true,noindexExcludedFromDiscovery:true,explicitFeedParticipation:true,defaultMemoExcludedFromFeed:true,legacyNoteSourcesUnchanged:true,styleReachedAstroOutput:true,fixedPageReachedRouteAndManifest:true,
  toolSourceInstallation:'covered separately by browser-tool-installation.test.ts',providerCalls:0,deploys:0,productionEligible:false}));
}finally{
 // Only remove the fresh operation-owned worktree under the system temp root.
 const within=relative(resolve(tmpdir()),resolve(workspace));
 if(created&&within&&!within.startsWith('..')&&!isAbsolute(within))execFileSync('git',['worktree','remove','--force',workspace],{cwd:repository,stdio:'pipe'});
}
