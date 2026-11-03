import {afterAll,expect,it,vi} from 'vitest';
import {readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const fixture=await vi.hoisted(async()=>{
 const {mkdtemp}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 return {root:await mkdtemp(join(tmpdir(),'migration-writer-test-'))};
});
vi.mock('../../packages/site-validators/src/phase5-taxonomy-inventory.js',async()=>{
 const {join}=await import('node:path');
 return {buildPhase5TaxonomyRawInventory:vi.fn(async()=>({version:'frozen-test'})),phase5TaxonomyRawInventoryPath:join(fixture.root,'inventory.json')};
});
vi.mock('../../packages/site-validators/src/phase5-taxonomy-materialization.js',async()=>{
 const {join}=await import('node:path');
 return {buildExpectedPhase5TaxonomyMaterialization:vi.fn(async()=>{throw Error('builder must not run before overwrite guard');}),
  taxonomyDataPath:join(fixture.root,'registry.ts'),taxonomyIndexPath:join(fixture.root,'index.ts'),phase5ManifestPath:join(fixture.root,'manifest.json')};
});
import {writePhase5TaxonomyRawInventory,writePhase5TaxonomyMaterialization} from './writers.js';
import {buildPhase5TaxonomyRawInventory} from '../../packages/site-validators/src/phase5-taxonomy-inventory.js';
import {buildExpectedPhase5TaxonomyMaterialization} from '../../packages/site-validators/src/phase5-taxonomy-materialization.js';
afterAll(()=>rm(fixture.root,{recursive:true,force:true}));

it('persists the shared inventory builder result without a second generation path',async()=>{
 await writePhase5TaxonomyRawInventory();
 expect(buildPhase5TaxonomyRawInventory).toHaveBeenCalledTimes(1);
 expect(await readFile(join(fixture.root,'inventory.json'),'utf8')).toBe(JSON.stringify({version:'frozen-test'},null,2)+'\n');
});
it('refuses materialization before generation when the repository has editorial revisions',async()=>{
 const ledger=JSON.parse(await readFile(resolve('docs/content/manual-editorial-revisions-v1.json'),'utf8'));
 expect(ledger.revisions.length).toBeGreaterThan(0);
 await expect(writePhase5TaxonomyMaterialization()).rejects.toThrow('Do not overwrite manual revisions');
 expect(buildExpectedPhase5TaxonomyMaterialization).not.toHaveBeenCalled();
 await expect(readFile(join(fixture.root,'manifest.json'))).rejects.toMatchObject({code:'ENOENT'});
});
