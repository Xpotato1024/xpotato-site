import {expect,it} from 'vitest';
import {mkdtemp,mkdir,copyFile,symlink,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import sharp from 'sharp';

it('runs favicon generation against the intended public directory after relocation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'favicon-tool-'));
 try{
  await mkdir(join(root,'tools/assets'),{recursive:true});
  await mkdir(join(root,'apps/site/public'),{recursive:true});
  await copyFile(resolve('tools/assets/generate-favicon.mjs'),join(root,'tools/assets/generate-favicon.mjs'));
  await copyFile(resolve('apps/site/public/xpotato-logo.svg'),join(root,'apps/site/public/xpotato-logo.svg'));
  await symlink(resolve('node_modules'),join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
  execFileSync(process.execPath,[join(root,'tools/assets/generate-favicon.mjs')],{encoding:'utf8',stdio:'pipe',timeout:10000});
  expect(await readFile(join(root,'apps/site/public/favicon.svg'),'utf8')).toContain('<svg');
  expect((await readFile(join(root,'apps/site/public/favicon.ico'))).subarray(0,4)).toEqual(Buffer.from([0,0,1,0]));
  for(const name of ['favicon.svg','favicon.ico','icon-apple-touch.png']) {
   const generated=await readFile(join(root,'apps/site/public',name));
   const committed=await readFile(resolve('apps/site/public',name));
   if(name.endsWith('.svg')) expect(generated.toString().replaceAll('\r\n','\n')).toBe(committed.toString().replaceAll('\r\n','\n'));
   else expect(generated).toEqual(committed);
  }
  const touch=sharp(await readFile(join(root,'apps/site/public/icon-apple-touch.png')));
  expect(await touch.metadata()).toMatchObject({format:'png',width:180,height:180,hasAlpha:false});
  const {data,info}=await touch.raw().toBuffer({resolveWithObject:true});
  expect(info.channels).toBe(3);
  for(const [x,y] of [[0,0],[179,0],[0,179],[179,179],[90,20]]) {
   expect([...data.subarray((y!*180+x!)*3,(y!*180+x!)*3+3)]).toEqual([255,255,255]);
  }
  const svgPixels=await sharp(await readFile(join(root,'apps/site/public/favicon.svg'))).ensureAlpha().raw().toBuffer();
  expect([...svgPixels].filter((_,index)=>index%4===3).every(alpha=>alpha===255)).toBe(true);
  await expect(readFile(join(root,'apps/site/favicon.svg'))).rejects.toMatchObject({code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
},15000);

it('rejects a one-parent escape before reading a photo, and accepts a child output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'review-photo-boundary-'));
 try{
  const allowed=join(root,'allowed');await mkdir(allowed);
  const script=resolve('tools/assets/optimize-review-photo.mjs'),missing=join(root,'missing.png');
  const run=(output:string)=>{
   try{execFileSync(process.execPath,[script,missing,output],{env:{...process.env,RUNNER_TEMP:allowed},encoding:'utf8',stdio:'pipe',timeout:10000});throw Error('Expected missing-input rejection');}
   catch(error){return String((error as {stderr?:string}).stderr??error);}
  };
  expect(run(join(root,'sibling'))).toContain('Review derivatives must remain below the temporary directory');
  const inside=run(join(allowed,'child'));
  expect(inside).not.toContain('Review derivatives must remain below the temporary directory');
  expect(inside).toContain('ENOENT');
  await expect(readFile(join(root,'sibling/review-photo-measurements.json'))).rejects.toMatchObject({code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
},25000);
