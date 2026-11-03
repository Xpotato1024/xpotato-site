import {afterEach,expect,it,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {browserToolPinSchema} from '@xpotato/content-contracts';
import {createToolFixture} from '../../../../tests/fixtures/browser-tools.js';
import {toolInstallationFixture} from '../../../../tests/fixtures/tool-installation.js';
import {verifyToolCandidate} from './browser-tool-adoption.js';
import {checkBrowserToolInstallations} from './browser-tool-installation.js';
import {installBrowserTool} from '../../../../tools/authoring/browser-tool-installation.js';
vi.mock('node:fs/promises',{spy:true});
const actual=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const roots:string[]=[],cache=process.env.npm_config_cache;
afterEach(async()=>{vi.mocked(writeFile).mockImplementation(actual.writeFile);if(cache===undefined)delete process.env.npm_config_cache;else process.env.npm_config_cache=cache;for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(withCurrentTool=false){const f=await toolInstallationFixture({withCurrentTool});roots.push(f.root);return f;}
async function candidate(root:string,toolId:string,bounded:boolean,version='1.0.0'){
 const f=await createToolFixture(root,{toolId,bounded,version}),repository='https://github.com/Example/'+toolId;
 execFileSync('git',['-C',f.sourceRoot,'remote','add','origin',repository]);
 const review={...f.review,source:{kind:'github' as const,repository},review:{reviewer:'synthetic unit-test evidence only',scope:'source-and-release' as const,decision:'admit' as const}};
 return {...f,review};
}
it('two distinct synchronous/Worker tools use the same new/public/update entrypoints and preserve editorial pages and historical artifacts',async()=>{
 const host=await fixture(true),originalPage=await readFile(join(host.siteRoot,'apps/site/src/content/tools/prime-factorizer.mdx'),'utf8'),notice=join(host.siteRoot,'apps/site/public/tool-licenses/prime-factorizer-v0.2.2/MUSL-COPYRIGHT.txt'),noticeBytes=await readFile(notice);
 for(const [i,toolId,bounded]of [[0,'synthetic-words',false],[1,'synthetic-transformer',true]] as const){
  const f=await candidate(join(host.root,toolId+'-v1'),toolId,bounded);
  const placement={...host.placement,contentId:i?'84caa6aa-296f-48d1-b84f-788e2b5d7524':host.placement.contentId,slug:toolId};
  const input={siteRoot:host.siteRoot,...f,releaseId:'test-v1',placement};
  expect(await installBrowserTool(input)).toMatchObject({draft:true,contentChanged:true,publication:false});
  await installBrowserTool({...input,apply:true});await checkBrowserToolInstallations(host.siteRoot);
  const pagePath=join(host.siteRoot,'apps/site/src/content/tools',toolId+'.mdx'),page=await readFile(pagePath,'utf8');
  const editorial=page.replace('"draft": true','"draft": false')+'\nEditorial explanation survives release updates.\n';
  await writeFile(pagePath,editorial);
  await expect(checkBrowserToolInstallations(host.siteRoot)).rejects.toThrow(/public admission/);
  const config=JSON.parse(await readFile(join(host.siteRoot,'config/browser-tools/installations.json'),'utf8')),prior=config.installations.find((x:any)=>x.pin.toolId===toolId).pin;
  const ap=join(host.siteRoot,'config/browser-tools/public-admissions.json'),admissions=JSON.parse(await readFile(ap,'utf8'));admissions.releases.push(prior);await writeFile(ap,JSON.stringify(admissions));
  await checkBrowserToolInstallations(host.siteRoot);
  const second=await candidate(join(host.root,toolId+'-v2'),toolId,bounded,'1.0.1');
  const pin=browserToolPinSchema.parse({...((await verifyToolCandidate(second)).pinFields),releaseId:'test-v2'});
  const update={siteRoot:host.siteRoot,...second,releaseId:'test-v2',replaceArtifact:prior.artifactSha256};
  await expect(installBrowserTool(update)).rejects.toThrow(/public admission/);
  expect(await installBrowserTool({...update,publicAdmission:pin})).toMatchObject({draft:false,contentChanged:false,publication:false});
  await installBrowserTool({...update,publicAdmission:pin,apply:true});await checkBrowserToolInstallations(host.siteRoot);
  expect(await readFile(pagePath,'utf8')).toBe(editorial);
  expect(await readFile(join(host.siteRoot,'vendor/browser-tools',toolId,'test-v1/browser-tool.json'),'utf8')).toContain('1.0.0');
  expect(await readFile(join(host.siteRoot,'vendor/browser-tools',toolId,'test-v2/browser-tool.json'),'utf8')).toContain('1.0.1');
  expect(await readFile(join(host.siteRoot,'apps/site/src/content-registry/interactive/releases.ts'),'utf8')).toContain(prior.artifactSha256);
  await expect(installBrowserTool({...update,publicAdmission:pin,replaceArtifact:'0'.repeat(64)})).rejects.toThrow(/replace-artifact/);
  await expect(installBrowserTool({...update,publicAdmission:pin,replaceArtifact:pin.artifactSha256,placement})).rejects.toThrow(/preserves placement/);
 }
 expect(await readFile(join(host.siteRoot,'apps/site/src/content/tools/prime-factorizer.mdx'),'utf8')).toBe(originalPage);
 expect(await readFile(notice)).toEqual(noticeBytes);
},120000);
it.each([false,true])('one transaction rolls back failures and preserves unexpected concurrent edits (%s)',async concurrent=>{
 const f=await fixture();await installBrowserTool({...f,apply:true});
 const next=await candidate(join(f.root,'next'),'synthetic-counter',false,'1.0.1');
 const paths=['config/browser-tools/installations.json','apps/site/package.json','package-lock.json','apps/site/src/content/tools/new-counter.mdx','apps/site/src/content-registry/interactive/generated/records.ts'];
 const before=await Promise.all(paths.map(p=>readFile(join(f.siteRoot,p),'utf8')));
 const prior=JSON.parse(before[0]!).installations[0].pin;let writes=0;
 vi.mocked(writeFile).mockImplementation(async(path,data,options)=>{
  if(String(path).includes('.browser-tool-transfer-')&&++writes===3){if(concurrent)await actual.writeFile(join(f.siteRoot,'apps/site/package.json'),'USER EDIT\n');throw Error('Injected transaction failure');}
  return actual.writeFile(path,data,options);
 });
 await expect(installBrowserTool({siteRoot:f.siteRoot,...next,releaseId:'test-v2',replaceArtifact:prior.artifactSha256,apply:true})).rejects.toThrow(concurrent?/preserve edits/:/Injected transaction failure/);
 vi.mocked(writeFile).mockImplementation(actual.writeFile);
 if(concurrent)expect(await readFile(join(f.siteRoot,'apps/site/package.json'),'utf8')).toBe('USER EDIT\n');else expect(await Promise.all(paths.map(p=>readFile(join(f.siteRoot,p),'utf8')))).toEqual(before);
 expect((await readdir(join(f.siteRoot,'.local'))).filter(p=>p.includes('lock'))).toEqual([]);
},60000);
it('refuses overlapping installer transactions without mutation',async()=>{
 const f=await fixture(),path=join(f.siteRoot,'.local/browser-tool-install.lock');await import('node:fs/promises').then(m=>m.mkdir(join(f.siteRoot,'.local'),{recursive:true}));await writeFile(path,'synthetic lock');
 const before=await readFile(join(f.siteRoot,'config/browser-tools/installations.json'));await expect(installBrowserTool({...f,apply:true})).rejects.toThrow(/EEXIST/);expect(await readFile(join(f.siteRoot,'config/browser-tools/installations.json'))).toEqual(before);
});
