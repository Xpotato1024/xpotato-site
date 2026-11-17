import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {expect,it} from 'vitest';
import {sha256} from '@xpotato/content-contracts/canonical';
import {prepareHomeWorkshopMobile} from './prepare-home-workshop-mobile.js';

it('pins the reviewed encoder workers for direct callers and reproduces all nine hashes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'home-mobile-encoder-')), previous=sharp.concurrency();
  try {
    const source=await sharp({create:{width:2400,height:1350,channels:3,background:'#665544'}}).webp({lossless:true}).toBuffer();
    const master=join(root,'master.webp');await writeFile(master,source);
    sharp.concurrency(4);
    const first=await prepareHomeWorkshopMobile(root,master,sha256(source),join(root,'first'));
    expect(sharp.concurrency()).toBe(1);
    sharp.concurrency(2);
    const second=await prepareHomeWorkshopMobile(root,master,sha256(source),join(root,'second'));
    expect(sharp.concurrency()).toBe(1);
    expect(first.delivery.objects).toHaveLength(9);
    expect(second.delivery).toEqual(first.delivery);
  } finally {sharp.concurrency(previous);await rm(root,{recursive:true,force:true});}
},30_000);