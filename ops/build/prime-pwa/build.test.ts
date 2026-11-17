import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPrimePwa} from './build.mjs';
import {renderSecurityHeaderArtifact} from '../../../packages/site-validators/src/delivery/security-headers.js';
const route='/tools/prime-factorizer/';
it('builds only the dependency closure and detects changed, remote and missing assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prime-pwa-build-'));
 const put=async(path:string,text:string|Buffer)=>{const file=join(root,path);await mkdir(join(file,'..'),{recursive:true});await writeFile(file,text);};
 try{
  await put('tools/prime-factorizer/index.html','<html><head><link rel="manifest" href="/tools/prime-factorizer/manifest.webmanifest"><link rel="stylesheet" href="/_astro/tool.css"></head><body><astro-island component-url="/_astro/tool.js" renderer-url="/_astro/react.js"></astro-island><details data-prime-offline></details><script src="/scripts/prime-pwa.js" defer></script></body></html>');
  await put('_headers',renderSecurityHeaderArtifact({scriptHashes:[],styleHashes:[],toolRoutes:[route],toolCapabilities:[{route,worker:true,wasm:true}],primeOffline:true}));
  await put('_astro/tool.js','import "./dependency.js";');await put('_astro/dependency.js','export const x=1;');await put('_astro/react.js','export {};');
  await put('_astro/tool.css','body{font-family:system-ui}');await put('_astro/unrelated.js','export const unrelated=true;');
  await put('scripts/prime-pwa.js',await readFile(new URL('../../../apps/site/public/scripts/prime-pwa.js',import.meta.url)));
  for(const size of [192,512])await put(`icon-prime-${size}.png`,'test icon bytes');
  const first=await buildPrimePwa(root);expect(first.files).toBe(9);await expect(buildPrimePwa(root,{check:true})).resolves.toEqual(first);
  const worker=await readFile(join(root,route,'sw.js'),'utf8');expect(worker).toContain('/_astro/dependency.js');expect(worker).not.toContain('/_astro/unrelated.js');
  await put('_astro/dependency.js','export const x=2;');await expect(buildPrimePwa(root,{check:true})).rejects.toThrow('PRIME_OFFLINE_RELEASE_CHANGED');
  expect((await buildPrimePwa(root)).version).not.toBe(first.version);
  await put('_astro/tool.css','@font-face{src:url(https://other.invalid/font.woff2)}');await expect(buildPrimePwa(root)).rejects.toThrow('PRIME_OFFLINE_UNSAFE_ASSET');
  await put('_astro/tool.css','@import "other.css";');await expect(buildPrimePwa(root)).rejects.toThrow('PRIME_OFFLINE_CSS_IMPORT');
  await put('_astro/tool.css','body{}');await put('_astro/tool.js','import "./missing.js";');await expect(buildPrimePwa(root)).rejects.toThrow();
 }finally{await rm(root,{recursive:true,force:true});}
});
