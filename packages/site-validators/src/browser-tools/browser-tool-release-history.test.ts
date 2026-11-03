import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {parseToolReleaseHistory} from './browser-tool-release-history.js';
it('reads every literal historical pin and rejects hidden/duplicate spreads or malformed registries',async()=>{
 const source=await readFile('apps/site/src/content-registry/interactive/releases.ts','utf8'),pins=parseToolReleaseHistory(source);
 expect(pins.length).toBeGreaterThan(0);expect(new Set(pins.map(p=>p.toolId+':'+p.releaseId)).size).toBe(pins.length);
 for(const body of ['...generatedReleases,...otherHistorical','...generatedReleases,...generatedReleases','...otherHistorical','...generatedReleases,,invalid(','...generatedReleases]; const browserToolReleases=[...generatedReleases']){
  expect(()=>parseToolReleaseHistory('export const browserToolReleases=Object.freeze(['+body+']);')).toThrow();
 }
});
