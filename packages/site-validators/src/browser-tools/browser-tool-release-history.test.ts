import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {parseToolReleaseHistory} from './browser-tool-release-history.js';
it('reads every literal historical pin and rejects factories, shadowing, hidden spreads and malformed registries',async()=>{
 const source=await readFile('apps/site/src/content-registry/interactive/releases.ts','utf8'),pins=parseToolReleaseHistory(source);
 expect(pins.length).toBeGreaterThan(0);expect(new Set(pins.map(p=>p.toolId+':'+p.releaseId)).size).toBe(pins.length);
 const changes=[source.replace('Object.freeze(','injectUnreviewed('),source.replace('Object.freeze(','Object.freeze?.('),
  source.replace('...generatedReleases,','...generatedReleases,...otherHistorical,'),source.replace('...generatedReleases,','...generatedReleases,...generatedReleases,'),
  source.replace('export const browserToolReleases','const browserToolReleases'),source.replace('export const browserToolReleases','export let browserToolReleases'),
  source+'\nconst Object={freeze:()=>[]};\n',source+'\nexport const browserToolReleases=Object.freeze([...generatedReleases]);\n',source.replace('Object.freeze([','[').replace(']);','];'),source+'\ninvalid('];
 for(const invalid of changes)expect(()=>parseToolReleaseHistory(invalid)).toThrow();
});
