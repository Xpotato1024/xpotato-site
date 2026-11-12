import {describe,it,expect} from 'vitest';
import {blogFrontmatterSchema,noteFrontmatterSchema,projectFrontmatterSchema,toolFrontmatterSchema,contentDiscoveryRecordSchema} from './content.js';
const common={id:'11111111-1111-4111-8111-111111111111',title:'日時',description:'fixture',pubDate:'2026-11-12',tags:[],draft:false};
describe('authored publication and update instants',()=>{
  for(const [schema,extra] of [[blogFrontmatterSchema,{category:'software'}],[noteFrontmatterSchema,{subject:'daily'}],[projectFrontmatterSchema,{status:'active'}],[toolFrontmatterSchema,{category:'calculation'}]] as const){
    it('keeps optional authored instants for '+JSON.stringify(extra),()=>{
      const parse=(fields:object)=>schema.safeParse({...common,...extra,...fields});
      expect(parse({}).success).toBe(true);
      expect(parse({publishedAt:'2026-11-11T16:00:00Z',updatedDate:'2026-11-12',updatedAt:'2026-11-12T12:00:00+09:00'}).success).toBe(true);
      for(const publishedAt of ['2026-11-12T12:00:00','2026-11-12T12:00+09:00','2026-02-30T12:00:00+09:00','2026-11-11T12:00:00+09:00','2026-11-12T12:00:00+14:01'])expect(parse({publishedAt}).success).toBe(false);
      expect(parse({updatedAt:'2026-11-12T12:00:00+09:00'}).success).toBe(false);
      expect(parse({publishedAt:'2026-11-12T12:00:00+09:00',updatedDate:'2026-11-12',updatedAt:'2026-11-12T11:00:00+09:00'}).success).toBe(false);
    });
  }
  it('retains page date-only compatibility in the shared discovery shape',()=>{
    expect(contentDiscoveryRecordSchema.safeParse({contentId:common.id,collection:'pages',route:'/about/',title:'About',description:'About',updatedDate:'2026-11-12',tagIds:[],featured:false,siteSearchEligible:true,webIndexable:true}).success).toBe(true);
  });
});
