import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {expect,it} from 'vitest';
import {generateSchemas} from './generate-schemas.js';
import {generatedSchemaPaths,generatedSchemaGroups} from '../src/schema-groups.js';

it('regenerates all grouped schemas from empty output without changing contract bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'schema-groups-'));
 try{
  await generateSchemas(root);await generateSchemas(root,true);
  expect(generatedSchemaPaths().size).toBe(82);expect(Object.keys(generatedSchemaGroups)).toHaveLength(8);
  for(const path of generatedSchemaPaths().values())expect(await readFile(join(root,path),'utf8')).toBe(await readFile(resolve('schemas/generated',path),'utf8'));
  await generateSchemas(root);await generateSchemas(root,true);
 }finally{await rm(root,{recursive:true,force:true});}
});
it('rejects stale, missing and unregistered nested artifacts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'schema-freshness-'));
 try{
  await generateSchemas(root);const path=join(root,[...generatedSchemaPaths().values()][0]!);
  await writeFile(path,'{}');await expect(generateSchemas(root,true)).rejects.toThrow('stale or missing');
  await generateSchemas(root);await rm(path);await expect(generateSchemas(root,true)).rejects.toThrow('stale or missing');
  await generateSchemas(root);await mkdir(join(root,'unexpected'));await writeFile(join(root,'unexpected/extra.txt'),'stale');
  await expect(generateSchemas(root,true)).rejects.toThrow('not registered');
 }finally{await rm(root,{recursive:true,force:true});}
});
