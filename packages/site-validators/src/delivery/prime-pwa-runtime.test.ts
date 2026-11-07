import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {inspectPrimePwaMarkup,validatePrimePwaSource} from './prime-pwa-runtime.js';
import {renderSecurityHeaderArtifact} from './security-headers.js';
import {parseStaticHeaderRules,headersForPath} from './static-headers.mjs';
const route='/tools/prime-factorizer/';
describe('Prime site-owned offline boundary',()=>{
 it('admits only the exact route-local progressive enhancement',()=>{
  const html='<details data-prime-offline></details><script src="/scripts/prime-pwa.js" defer></script>';
  expect(inspectPrimePwaMarkup(html,route).script).toBe(true);
  expect(()=>inspectPrimePwaMarkup(html,'/search/')).toThrow();
  expect(()=>inspectPrimePwaMarkup(html.replace(' defer',' async'),route)).toThrow();
  const source=readFileSync(new URL('../../../../apps/site/public/scripts/prime-pwa.js',import.meta.url),'utf8');
  expect(()=>validatePrimePwaSource(source)).not.toThrow();
  for(const extra of ['fetch("/")','localStorage.setItem("x","y")','input.value','el.innerHTML'])expect(()=>validatePrimePwaSource(source+extra)).toThrow();
 });
 it('keeps document and compute network blocked, while only the scoped SW can precache',()=>{
  const input={scriptHashes:[],styleHashes:[],toolRoutes:[route],toolCapabilities:[{route,worker:true,wasm:true}]};
  const baseline=parseStaticHeaderRules(renderSecurityHeaderArtifact(input));
  const rules=parseStaticHeaderRules(renderSecurityHeaderArtifact({...input,primeOffline:true}));
  const doc=headersForPath(route,rules)['content-security-policy'];
  expect(doc).toContain("connect-src 'none'");expect(doc).toContain("worker-src blob: 'self'");
  const sw=headersForPath(route+'sw.js',rules)['content-security-policy'];
  expect(sw).toContain("connect-src 'self'");expect(sw).not.toContain('wasm-unsafe-eval');expect(sw).not.toContain('unsafe-inline');
  expect(headersForPath('/',rules)).toEqual(headersForPath('/',baseline));
  expect(headersForPath('/search/',rules)).toEqual(headersForPath('/search/',baseline));
  expect(headersForPath(route+'sw.js',rules)['cache-control']).toBe('no-cache');
  expect(()=>parseStaticHeaderRules('/tools/other/sw.js\n  ! Content-Security-Policy\n  Content-Security-Policy: default-src self\n')).toThrow();
 });
});
