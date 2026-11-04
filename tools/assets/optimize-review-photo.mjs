import sharp from 'sharp';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
const [sourceArg,outputArg]=process.argv.slice(2);if(!sourceArg||!outputArg)throw Error('Usage: optimize-review-photo.mjs SOURCE OUTPUT-TEMP-DIRECTORY');
const output=resolve(outputArg),within=relative(resolve(process.env.RUNNER_TEMP??tmpdir()),output);if(!within||within.startsWith('..')||isAbsolute(within))throw Error('Review derivatives must remain below the temporary directory');
const source=await readFile(sourceArg),metadata=await sharp(source).metadata();if(!metadata.width||!metadata.height)throw Error('Unknown source dimensions');await mkdir(output,{recursive:true});
const widths=[640,960,1440,1920].filter(width=>width<=metadata.width),variants=[];
// Review-only trial using the existing photo-hero-v1 quality settings.
for(const width of widths)for(const format of ['avif','webp','jpg']){
 const filename=`workshop-${width}.${format}`,path=join(output,filename);let image=sharp(source).rotate().resize({width,withoutEnlargement:true});
 image=format==='avif'?image.avif({quality:55,effort:4}):format==='webp'?image.webp({quality:82,effort:4}):image.jpeg({quality:86,mozjpeg:true});
 const info=await image.toFile(path);variants.push({filename,width:info.width,height:info.height,bytes:(await stat(path)).size,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
}
const report={profile:'workshop-review-photo-v1',productionEligible:false,sourceSha256:createHash('sha256').update(source).digest('hex'),sourceBytes:source.length,sourceDimensions:{width:metadata.width,height:metadata.height},toolchain:sharp.versions,quality:{avif:55,webp:82,jpeg:86},variants};await writeFile(join(output,'review-photo-measurements.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
