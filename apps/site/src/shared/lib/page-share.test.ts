import {describe,expect,it} from 'vitest';
import {derivePageShare} from './page-share.js';
const input={collection:'tools',title:'素因数分解機 & 例 #1',canonical:'https://xpotato.net/tools/prime-factorizer/?input=secret#result',canonicalOrigin:'https://xpotato.net/',published:true,noindex:false,preview:false};
describe('public page sharing only',()=>{
 it('encodes Japanese names and the canonical public URL, discarding query/hash',()=>{
  const share=derivePageShare(input)!;expect(share.url).toBe('https://xpotato.net/tools/prime-factorizer/');
  for(const href of [share.x,share.line]){const url=new URL(href);expect(url.searchParams.get('text')).toBe(input.title);expect(url.searchParams.get('url')).toBe(share.url);expect([...url.searchParams.keys()].sort()).toEqual(['text','url']);expect(href).not.toContain('secret');}
  expect(new URL(share.x).origin).toBe('https://x.com');expect(new URL(share.line).origin).toBe('https://social-plugins.line.me');
 });
 it.each(['blog','notes','tools'])('supports the public %s detail collection',collection=>{expect(derivePageShare({...input,collection,canonical:collection==='blog'?'https://xpotato.net/articles/0h248h248h848r248h248h248h/':`https://xpotato.net/${collection}/public/`})).toBeDefined();});
 it.each(['/articles/','/articles/category/software/','/articles/manual-slug/','/blog/old/'])('rejects article archive and obsolete paths for sharing: %s',path=>{expect(derivePageShare({...input,collection:'blog',canonical:'https://xpotato.net'+path})).toBeUndefined();});
 it.each([{published:false},{noindex:true},{preview:true},{collection:'projects'},{collection:'pages'},{canonical:'http://100.110.169.96:21120/tools/prime-factorizer/'},{canonical:'https://foreign.example/tools/private/'},{canonical:'https://user:pass@xpotato.net/tools/private/'},{canonical:'javascript:alert(1)'},{canonical:'not a URL'},{canonical:'https://xpotato.net/__private/'},{title:' '}])('does not create a destination for ineligible content %j',override=>{expect(derivePageShare({...input,...override})).toBeUndefined();});
});
