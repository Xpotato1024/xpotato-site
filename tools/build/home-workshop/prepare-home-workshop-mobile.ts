import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { fingerprint, sha256 } from '@xpotato/content-contracts/canonical';
import { sharpToolchainSha256 } from '@xpotato/media-ingest';
import { homeWorkshopMobileProfile, validateHomeWorkshopMobileDelivery } from '../../../apps/site/src/lib/home/home-workshop-mobile.js';

export async function prepareHomeWorkshopMobile(root: string, masterPath: string, masterSha256: string, output: string) {
  const source = await readFile(masterPath);
  if (sha256(source) !== masterSha256) throw Error('Homepage mobile source drift');
  await mkdir(output, {recursive:true});
  const profile = homeWorkshopMobileProfile, localObjects = [];
  for (const width of profile.widths) for (const format of profile.formats) {
    const bytes = await sharp(source).extract(profile.crop).resize({width,withoutEnlargement:true}).toFormat(format.format,{quality:format.quality}).toBuffer();
    const hash = sha256(bytes), extension = format.format === 'jpeg' ? 'jpg' : format.format;
    const path = join(output, hash+'.'+extension);
    await writeFile(path,bytes,{flag:'wx'});
    localObjects.push({sha256:hash,objectKey:`media/v1/objects/sha256/${hash.slice(0,2)}/${hash}.${extension}`,
      format:format.format,width,height:width*27/32,sizeBytes:bytes.length,privateRelativePath:relative(root,path).replaceAll('\\','/')});
  }
  const delivery = validateHomeWorkshopMobileDelivery({profileId:profile.id,profileSha256:fingerprint(profile),sourceMasterSha256:masterSha256,
    toolchainSha256:sharpToolchainSha256(),objects:localObjects.map(({privateRelativePath:_,...object})=>object)});
  return {delivery,localObjects};
}
