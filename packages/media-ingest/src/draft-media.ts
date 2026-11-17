import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import sharp from 'sharp';
import {mediaPolicy,assertMediaBudget,sniffMedia,type MediaKind} from '@xpotato/editor-core/policy';
import {inspectImage} from '@xpotato/editor-core/image-inspection';
import {encodeAnimation,inspectAnimationBytes} from './animation.js';
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
export interface DraftMediaResult {
 master:Buffer;preview:Buffer;
 metadata:{schemaVersion:1;profile:'editor-draft-media-v1';kind:MediaKind;sourceSha256:string;sha256:string;previewSha256:string;sourceBytes:number;bytes:number;previewBytes:number;mime:string;width:number;height:number;lossy:boolean;resized:boolean;metadataStripped:true;sourceRetained:boolean;transform:string;animation?:{frameCount:number;durationMs:number;loop:number;delaysMs:number[]};playbackSha256?:string};
}
export async function decodeHeif(input:Uint8Array,timeoutMs=30000):Promise<{data:Buffer;width:number;height:number}> {
 if(!input.byteLength||input.byteLength>mediaPolicy.inputBytes||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw Error('HEIC_DECODE_BUDGET');
 const bytes=input.slice();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./heif-worker.mjs',import.meta.url),{workerData:{input:bytes.buffer,maxPixels:mediaPolicy.maxPixels,maxDimension:mediaPolicy.maxDimension},transferList:[bytes.buffer],resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32}});
  let settled=false;
  const finish=(failure:Error|null,value?:{data:Buffer;width:number;height:number})=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();if(failure)reject(failure);else resolve(value!);};
  const timer=setTimeout(()=>finish(Error('HEIC_DECODE_TIMEOUT')),timeoutMs);
  worker.once('error',()=>finish(Error('HEIC_DECODE_FAILED')));
  worker.once('exit',code=>{if(!settled)finish(Error(code===0?'HEIC_DECODE_INCOMPLETE':'HEIC_DECODE_FAILED'));});
  worker.once('message',(message:{ok:boolean;error?:string;data?:ArrayBuffer;width?:number;height?:number})=>{
   if(!message.ok)return finish(Error(message.error??'HEIC_DECODE_FAILED'));
   const width=message.width!,height=message.height!,data=message.data;
   if(!data||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>mediaPolicy.maxPixels||data.byteLength!==width*height*4)return finish(Error('HEIC_DECODE_RESULT_INVALID'));
   finish(null,{data:Buffer.from(data),width,height});
  });
 });
}
export async function prepareDraftMedia(input:Uint8Array,kind:MediaKind,options:{allowLossy?:boolean;heicTimeoutMs?:number}={}):Promise<DraftMediaResult> {
 if(!['photo','technical','animation'].includes(kind))throw Error('MEDIA_KIND_INVALID');
 if(!input.byteLength||input.byteLength>mediaPolicy.inputBytes)throw Error('INPUT_BYTES_LIMIT');
 const source=Buffer.from(input),mime=sniffMedia(input),sourceSha256=hash(source);
 const sourceInspection=mime==='image/heic'?null:inspectImage(input,null);
 if(sourceInspection?.animated&&kind!=='animation')throw Error('ANIMATION_PROFILE_REQUIRED');
 if(kind==='animation'&&!sourceInspection?.animated)throw Error('ANIMATION_REQUIRED');
 let master:Buffer,width:number,height:number,lossy=false,resized=false,transform:string;
 let animation:DraftMediaResult['metadata']['animation'],playbackSha256:string|undefined;
 if(kind==='animation'){
  const encoded=await encodeAnimation(source);master=encoded.data;width=encoded.width;height=encoded.height;
  animation={...encoded.animation,durationMs:encoded.animation.delaysMs.reduce((sum,value)=>sum+value,0),delaysMs:[...encoded.animation.delaysMs]};playbackSha256=encoded.playbackSha256;transform='animation-webp-lossless-v1';
 }else{
  let pipeline:ReturnType<typeof sharp>,sourceWidth:number,sourceHeight:number;
  if(mime==='image/heic'){const decoded=await decodeHeif(source,options.heicTimeoutMs);sourceWidth=decoded.width;sourceHeight=decoded.height;pipeline=sharp(decoded.data,{raw:{width:decoded.width,height:decoded.height,channels:4},limitInputPixels:mediaPolicy.maxPixels});}
  else {const metadata=await sharp(source,{limitInputPixels:mediaPolicy.maxPixels,failOn:'error'}).metadata();if((metadata.pages??1)!==1||!metadata.width||!metadata.height)throw Error('STILL_IMAGE_REQUIRED');sourceWidth=metadata.width;sourceHeight=metadata.height;pipeline=sharp(source,{limitInputPixels:mediaPolicy.maxPixels,failOn:'error'}).rotate();}
  if(sourceWidth*sourceHeight>mediaPolicy.maxPixels||Math.max(sourceWidth,sourceHeight)>mediaPolicy.maxDimension)throw Error('MEDIA_DECODE_BUDGET');
  pipeline=pipeline.toColourspace('srgb');
  if(kind==='photo'){
   if(options.allowLossy!==true)throw Error('LOSSY_CONVERSION_REQUIRES_ACKNOWLEDGEMENT');
   resized=Math.max(sourceWidth,sourceHeight)>mediaPolicy.photo.maxEdge;
   if(resized)pipeline=pipeline.resize({width:mediaPolicy.photo.maxEdge,height:mediaPolicy.photo.maxEdge,fit:'inside',withoutEnlargement:true});
   pipeline=pipeline.webp({quality:Math.round(mediaPolicy.photo.quality*100),effort:4});lossy=true;transform='photo-webp-draft-v1';
  }else{pipeline=pipeline.webp({lossless:true,exact:true,effort:6});transform='technical-webp-lossless-v1';}
  const encoded=await pipeline.toBuffer({resolveWithObject:true});master=encoded.data;width=encoded.info.width;height=encoded.info.height;
 }
 assertMediaBudget(kind,master.length);inspectImage(master,kind);
 const metadata=await sharp(master,{animated:kind==='animation',limitInputPixels:mediaPolicy.maxPixels}).metadata();
 if(metadata.exif||metadata.xmp||metadata.iptc||metadata.orientation)throw Error('DRAFT_PRIVATE_METADATA_RETAINED');
 let preview=await sharp(master,{page:0,pages:1,limitInputPixels:mediaPolicy.maxPixels}).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:4}).toBuffer();
 if(preview.length>mediaPolicy.previewBytes)preview=await sharp(master,{page:0,pages:1,limitInputPixels:mediaPolicy.maxPixels}).resize({width:320,height:320,fit:'inside',withoutEnlargement:true}).webp({quality:75,effort:4}).toBuffer();
 if(preview.length>mediaPolicy.previewBytes)throw Error('PREVIEW_BYTES_LIMIT');
 return {master,preview,metadata:{schemaVersion:1,profile:'editor-draft-media-v1',kind,sourceSha256,sha256:hash(master),previewSha256:hash(preview),sourceBytes:source.length,bytes:master.length,previewBytes:preview.length,mime:'image/webp',width,height,lossy,resized,metadataStripped:true,sourceRetained:false,transform,...(animation?{animation}:{}),...(playbackSha256?{playbackSha256}:{})}};
}
