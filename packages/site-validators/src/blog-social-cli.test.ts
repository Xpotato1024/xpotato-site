import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,symlink,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cli=require.resolve('tsx/cli');
const fm={id:'00000000-0000-4000-8000-000000000001',title:'安全な設計を小さく試す',description:'検証用',pubDate:'2026-10-29',category:'software',tags:[],draft:true,cardDisplay:{lines:['安全な設計を','小さく試す']}};
it('prepares repeatable private PNG and refuses a link in the derived ContentId subtree',async()=>{
 const scratch=await mkdtemp(join(tmpdir(),'social-cli-')),parent=resolve('.local/blog-social-cards'),output=await mkdtemp(join(await mkdir(parent,{recursive:true}).then(()=>parent),'cli-test-'));
 try{
  const input=join(scratch,'input.json');await writeFile(input,JSON.stringify(fm));
  const invoke=()=>JSON.parse(execFileSync(process.execPath,[cli,'scripts/blog-social-card.ts','--input',input,'--output',output],{cwd:resolve('.'),encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  const a=invoke(),b=invoke();expect(a).toEqual(b);expect(a.productionEligible).toBe(false);
  const receipt=JSON.parse(await readFile(join(a.folder,'recipe.json'),'utf8'));expect(receipt.publicationAuthorized).toBe(false);expect(receipt.title).toBe(fm.title);
  await writeFile(input,JSON.stringify({...fm,description:'説明だけ更新',seo:{titleOverride:'SEOだけ更新'}}));
  const metadata=invoke();expect(metadata.sha256).toBe(a.sha256);expect(metadata.folder).not.toBe(a.folder);
  await rm(join(output,fm.id),{recursive:true,force:true});
  const escape=join(scratch,'outside');await mkdir(escape);await symlink(escape,join(output,fm.id),process.platform==='win32'?'junction':'dir');
  expect(invoke).toThrow();expect(await readdir(escape)).toEqual([]);
 }finally{await rm(output,{recursive:true,force:true});await rm(scratch,{recursive:true,force:true});}
},30000);
