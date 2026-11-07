import { describe, expect, it } from 'vitest';
import { contactEmail, deriveContactTargets, getToolIssueLink, siteIssueUrl } from './contact.js';
import { siteConfig } from './site-config.js';
import {deriveContentCatalog,type CatalogSourceRecord} from './discovery/catalog.js';
import {taxonomyRegistry} from '../content-registry/taxonomy/index.js';

describe('public contact destinations', () => {
  it('keeps site and calculation reports on their respective public repositories', () => {
    expect(siteIssueUrl).toBe('https://github.com/Xpotato1024/xpotato-site/issues/new');
    expect(getToolIssueLink('prime-factorizer')?.href).toBe('https://github.com/Xpotato1024/browser-prime-toolkit/issues/new');
    expect(getToolIssueLink('unknown-tool')).toBeUndefined();
    expect(getToolIssueLink(undefined)).toBeUndefined();
    expect(contactEmail).toBe('321miyuto@xpotato.net');
  });
  it('follows catalog additions, title changes and visibility without a second list', () => {
    const tool = (id:string,title:string,draft=false,noindex=false):CatalogSourceRecord => ({collection:'tools',slug:`tool-${id}`,data:{id,title,description:'Test tool',pubDate:'2026-11-01',category:'calculation',tags:[],draft,seo:{noindex}}});
    const prime='bca48f98-c89a-457f-84d8-168f941fe469',future='11111111-1111-4111-8111-111111111111';
    const targets=deriveContactTargets(deriveContentCatalog([
      tool(prime,'名前を変更した計算機'), tool(future,'新しいツール'),
      tool('22222222-2222-4222-8222-222222222222','下書き',true),
      tool('33333333-3333-4333-8333-333333333333','非掲載',false,true),
    ],taxonomyRegistry));
    expect(targets).toHaveLength(3);
    expect(targets.find(t=>t.id===prime)).toMatchObject({label:'名前を変更した計算機',issue:true,href:'https://github.com/Xpotato1024/browser-prime-toolkit/issues/new'});
    expect(targets.find(t=>t.id===future)).toMatchObject({label:'新しいツール',issue:false,href:`mailto:${contactEmail}`});
    expect(deriveContactTargets([])).toEqual([targets[0]]);
  });
  it('requires the active selected release and a confirmed repository capability', () => {
    const records={modules:{future:{id:'future',status:'active',role:'primary_tool',releaseId:'v2'}},bindings:[],releases:[{toolId:'future',releaseId:'v1',source:{kind:'github',repository:'https://github.com/Xpotato1024/browser-prime-toolkit'}},{toolId:'future',releaseId:'v2',source:{kind:'github',repository:'https://github.com/Xpotato1024/unconfirmed-tool'}}]};
    expect(getToolIssueLink('future',records)).toBeUndefined();
    records.releases[1]!.source.repository='https://github.com/Xpotato1024/browser-prime-toolkit';
    expect(getToolIssueLink('future',records)?.href).toBe('https://github.com/Xpotato1024/browser-prime-toolkit/issues/new');
    records.modules.future.status='retired';
    expect(getToolIssueLink('future',records)).toBeUndefined();
  });
  it('publishes only the supplied profiles, without tracking queries or a fabricated LinkedIn account', () => {
    expect(siteConfig.socialLinks.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: 'instagram', href: 'https://www.instagram.com/miyu_to_x/' },
      { id: 'x', href: 'https://twitter.com/bael_fps' },
      { id: 'github', href: 'https://github.com/Xpotato1024' },
    ]);
    for (const link of siteConfig.socialLinks) {
      expect(new URL(link.href).search).toBe('');
      expect(link.rel).toContain('noreferrer');
    }
  });
});
