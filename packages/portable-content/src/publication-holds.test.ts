import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {readPublicationHoldIds,assertPublicationHolds} from './publication-holds.mjs';
const value=JSON.parse(readFileSync('content/registry/publication-holds.json','utf8'));
describe('current publication hold policy',()=>{
 it('retains all 44 distinct unpublished identities',()=>{const ids=readPublicationHoldIds(value);expect(ids).toHaveLength(44);expect(new Set(ids).size).toBe(44);});
 it('rejects loss, duplicate identity, unsupported reason and extra fields',()=>{for(const mutate of [(v:any)=>v.records.pop(),(v:any)=>v.records[1]=v.records[0],(v:any)=>v.records[0].reason='approved',(v:any)=>v.records[0].draft=false]){const bad=structuredClone(value);mutate(bad);expect(()=>readPublicationHoldIds(bad)).toThrow('HELD_MANIFEST_POLICY_CHANGED');}});
 it('never allows a hold to become public or silently disappear',()=>{const id=value.records[0].contentId;const entry:any={routeRecord:{contentId:id,collection:'blog'},source:{data:{draft:true}},disposition:'held_candidate'};expect(()=>assertPublicationHolds([entry],[id])).not.toThrow();for(const bad of [[],[entry,entry],[{...entry,disposition:'published'}],[{...entry,source:{data:{draft:false}}}]])expect(()=>assertPublicationHolds(bad,[id])).toThrow('PUBLICATION_HOLD_VIOLATED');});
});
