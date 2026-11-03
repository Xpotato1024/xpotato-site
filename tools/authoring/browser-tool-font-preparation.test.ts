import {afterAll,beforeAll,afterEach,beforeEach,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
let root:string,prepareFixedFonts:(element:object,finish:(ok:boolean)=>void)=>()=>void;
beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),'fixed-font-test-'));await cp(resolve('templates/browser-tool-sync/src/ui/prepare-fonts.mjs'),join(root,'prepare-fonts.mjs'));await cp(resolve('packages/site-validators/fixtures/synthetic-browser-tool/src/font-text.mjs'),join(root,'font-text.mjs'));({prepareFixedFonts}=createRequire(import.meta.url)(join(root,'prepare-fonts.mjs')));});
afterAll(async()=>{if(root)await rm(root,{recursive:true,force:true});});
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('getComputedStyle',()=>({fontFamily:'"Host Japanese", sans-serif'}));});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
it('prepares only supplied fixed text with the inherited family before reporting ready',async()=>{
 let resolve!:()=>void;const load=vi.fn((_font:string,_text:string)=>new Promise<void>(r=>{resolve=r;})),finish=vi.fn();vi.stubGlobal('document',{fonts:{load}});
 const cancel=prepareFixedFonts({closest:()=>({getAttribute:()=> '対応ソース'})},finish);await settle();
 expect(load).toHaveBeenCalledWith('1rem "Host Japanese", sans-serif',expect.stringContaining('試験用文字列'));expect(load.mock.calls[0]?.[1]).toContain('対応ソース');expect(load.mock.calls[0]?.[1]).not.toContain('dynamic-user-canary');expect(finish).not.toHaveBeenCalled();
 resolve();await settle();expect(finish).toHaveBeenCalledExactlyOnceWith(true);expect(vi.getTimerCount()).toBe(0);cancel();
});
it('failure and timeout stay failed, late completion is ignored, and a fresh retry can succeed',async()=>{
 const finish=vi.fn(),load=vi.fn().mockRejectedValueOnce(Error('unavailable')).mockImplementationOnce(()=>new Promise<void>(r=>{late=r;})).mockResolvedValueOnce([]);let late!:()=>void;
 vi.stubGlobal('document',{fonts:{load}});prepareFixedFonts({},finish);await settle();expect(finish).toHaveBeenLastCalledWith(false);
 prepareFixedFonts({},finish);await settle();await vi.advanceTimersByTimeAsync(5000);expect(finish).toHaveBeenCalledTimes(2);late();await settle();expect(finish).toHaveBeenCalledTimes(2);
 prepareFixedFonts({},finish);await settle();expect(finish).toHaveBeenLastCalledWith(true);expect(vi.getTimerCount()).toBe(0);
});
it('early unmount starts no load, later unmount suppresses completion, and missing API fails',async()=>{
 let resolve!:()=>void;const load=vi.fn(()=>new Promise<void>(r=>{resolve=r;})),finish=vi.fn();vi.stubGlobal('document',{fonts:{load}});
 const early=prepareFixedFonts({},finish);early();await settle();expect(load).not.toHaveBeenCalled();expect(finish).not.toHaveBeenCalled();
 const cancel=prepareFixedFonts({},finish);await settle();cancel();resolve();await settle();expect(finish).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
 vi.stubGlobal('document',{});prepareFixedFonts({},finish);await settle();expect(load).toHaveBeenCalledTimes(1);expect(finish).toHaveBeenCalledExactlyOnceWith(false);
 vi.stubGlobal('document',{fonts:{load}});prepareFixedFonts({closest:()=>({getAttribute:()=> 'x'.repeat(4097)})},finish);await settle();expect(load).toHaveBeenCalledTimes(1);expect(finish).toHaveBeenCalledTimes(2);expect(finish).toHaveBeenLastCalledWith(false);
});
