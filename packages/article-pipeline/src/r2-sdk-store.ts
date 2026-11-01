import {S3Client,GetObjectCommand,PutObjectCommand,type S3ClientConfig} from '@aws-sdk/client-s3';
import {z} from 'zod';
import {sha256,fingerprint} from './canonical.js';
import type {Plane} from './publication-contracts.js';

const bucket=z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u);
export const r2PublicationConfigSchema=z.object({schemaVersion:z.literal(1),accountId:z.string().regex(/^[a-f0-9]{32}$/u),
 buckets:z.object({source:bucket,public:bucket,protected:bucket}).strict(),publicOrigin:z.literal('https://assets.xpotato.net'),
 // One-time configuration acceptance, not a claim of live policy observation.
 acceptance:z.object({basis:z.literal('owner-reviewed-configuration-v1'),revision:z.string().regex(/^[a-f0-9]{40}$/u),
  confirmedAt:z.iso.datetime({offset:true}),sourcePrivate:z.literal(true),protectedPrivate:z.literal(true),
  protectedLock:z.literal('site-protected-all-v1:all-prefixes:Indefinite'),automaticExpiration:z.literal(false)}).strict()
}).strict().refine(c=>new Set(Object.values(c.buckets)).size===3,'distinct storage buckets required');
export type R2PublicationConfig=z.infer<typeof r2PublicationConfigSchema>;
export type PublishObject={plane:Plane;key:string;sha256:string;sizeBytes:number;contentType:string;cacheControl:string;bytes:Uint8Array};
export type SdkObjectRead={status:'absent'}|{status:'found';bytes:Buffer;contentType:string;cacheControl:string};
export interface PublicationStorage{
 readonly configurationSha256:string;
 read(object:PublishObject,signal?:AbortSignal):Promise<SdkObjectRead>;
 putIfAbsent(object:PublishObject,signal?:AbortSignal):Promise<'uploaded'|'reused'>;
 readPublic(object:PublishObject,signal?:AbortSignal):Promise<SdkObjectRead>;
 close():void;
}
const matches=(o:PublishObject,r:SdkObjectRead)=>r.status==='found'&&r.bytes.length===o.sizeBytes&&sha256(r.bytes)===o.sha256
 &&r.contentType===o.contentType&&r.cacheControl===o.cacheControl;
export function assertObjectMatches(o:PublishObject,r:SdkObjectRead){if(!matches(o,r))throw Error('R2_BYTES_OR_METADATA_MISMATCH');}
export function validatePublishObject(o:PublishObject){
 const m=/^(source|media)\/v1\/objects\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.(webp|svg|png|jpg|jpeg|avif)$/u.exec(o.key);
 if(!['source','public','protected'].includes(o.plane)||!m||m[1]!== (o.plane==='source'?'source':'media')||m[2]!==o.sha256.slice(0,2)||m[3]!==o.sha256
  ||o.plane==='source'&&!['svg','webp'].includes(m[4]!)||o.bytes.length!==o.sizeBytes||o.sizeBytes<=0||o.sizeBytes>24*1024*1024||sha256(o.bytes)!==o.sha256
  ||o.contentType!==(m[4]==='svg'?'image/svg+xml':'image/'+(m[4]==='jpg'?'jpeg':m[4]))
  ||o.cacheControl!==(o.plane==='public'?'public, max-age=31536000, immutable':'private, no-store'))throw Error('R2_OBJECT_NOT_ADMITTED');
}
async function boundedBytes(body:AsyncIterable<Uint8Array>|null|undefined,max:number,signal:AbortSignal){
 if(!body)throw Error('R2_READ_UNKNOWN');const parts:Buffer[]=[];let size=0;
 for await(const part of body){signal.throwIfAborted();size+=part.length;if(size>max)throw Error('R2_READ_TOO_LARGE');parts.push(Buffer.from(part));}
 signal.throwIfAborted();return Buffer.concat(parts,size);
}
/** The sender seam is for deterministic tests. Production always constructs
 * the standard S3Client below; package JSON cannot supply executable ports. */
export function createR2SdkStorage(configInput:unknown,credentials:{accessKeyId:string;secretAccessKey:string},
 dependencies:{send?:S3Client['send'];fetcher?:typeof fetch;requestHandler?:S3ClientConfig['requestHandler']}={}):PublicationStorage{
 const config=r2PublicationConfigSchema.parse(configInput);
 if(Date.parse(config.acceptance.confirmedAt)>Date.now()||!credentials.accessKeyId||!credentials.secretAccessKey)throw Error('R2_CONFIGURATION_REQUIRED');
 // R2 exposes a 32-hex token ID and a SHA-256 secret. Report only a fixed
 // format verdict, never the value, length, fingerprint or provider message.
 if(!/^[a-f0-9]{32}$/iu.test(credentials.accessKeyId)||!/^[a-f0-9]{64}$/iu.test(credentials.secretAccessKey))throw Error('R2_CREDENTIAL_FORMAT_INVALID');
 const client=new S3Client({region:'auto',endpoint:`https://${config.accountId}.r2.cloudflarestorage.com`,forcePathStyle:true,
  credentials,maxAttempts:1,followRegionRedirects:false,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',
  requestHandler:dependencies.requestHandler??{connectionTimeout:10000,requestTimeout:30000}});
 const send=dependencies.send??client.send.bind(client),fetcher=dependencies.fetcher??fetch;let closed=false;
 const active=(outer?:AbortSignal)=>{if(closed)throw Error('R2_SESSION_CLOSED');return AbortSignal.any([AbortSignal.timeout(30000),...(outer?[outer]:[])]);};
 const read=async(object:PublishObject,outer?:AbortSignal):Promise<SdkObjectRead>=>{
  validatePublishObject(object);const signal=active(outer);signal.throwIfAborted();
  try{
   const r=await send(new GetObjectCommand({Bucket:config.buckets[object.plane],Key:object.key}),{abortSignal:signal});
   if(r.ContentLength!==object.sizeBytes)throw Error('R2_BYTES_OR_METADATA_MISMATCH');
   const bytes=await boundedBytes(r.Body as AsyncIterable<Uint8Array>,object.sizeBytes,signal);
   return {status:'found',bytes,contentType:r.ContentType??'',cacheControl:r.CacheControl??''};
  }catch(e){const error=e as {name?:string;$metadata?:{httpStatusCode?:number}};
   // Permission failure and generic 404 are never authoritative absence.
   if(error.name==='NoSuchKey'&&error.$metadata?.httpStatusCode===404)return {status:'absent'};
   if(error.$metadata?.httpStatusCode===401||error.$metadata?.httpStatusCode===403)throw Error('R2_READ_AUTHORIZATION_FAILED');
   if(error.$metadata?.httpStatusCode===404)throw Error('R2_READ_ABSENCE_UNCONFIRMED');
   if(e instanceof Error&&['R2_BYTES_OR_METADATA_MISMATCH','R2_READ_TOO_LARGE'].includes(e.message))throw e;
   throw Error('R2_READ_UNKNOWN');
  }
 };
 return Object.freeze({configurationSha256:fingerprint(config),read,
  async putIfAbsent(object:PublishObject,outer?:AbortSignal){
   validatePublishObject(object);const before=await read(object,outer);
   if(before.status==='found'){assertObjectMatches(object,before);return 'reused';}
   const signal=active(outer);signal.throwIfAborted();let outcome:'uploaded'|'reused'='uploaded';
   try{await send(new PutObjectCommand({Bucket:config.buckets[object.plane],Key:object.key,Body:Uint8Array.from(object.bytes),ContentLength:object.sizeBytes,
    ContentType:object.contentType,CacheControl:object.cacheControl,IfNoneMatch:'*',Metadata:{sha256:object.sha256}}),{abortSignal:signal});}
   catch(e){const r=e as {name?:string;$metadata?:{httpStatusCode?:number}};
    if(r.$metadata?.httpStatusCode===412||r.name==='ObjectLockedByBucketPolicy'&&r.$metadata?.httpStatusCode===409)outcome='reused';
    else throw Error('R2_PUT_UNKNOWN_NO_RETRY');}
   signal.throwIfAborted();assertObjectMatches(object,await read(object,outer));return outcome;
  },
  async readPublic(object:PublishObject,outer?:AbortSignal){
   validatePublishObject(object);if(object.plane!=='public')throw Error('R2_PUBLIC_OBJECT_REQUIRED');
   const signal=active(outer),r=await fetcher(config.publicOrigin+'/'+object.key,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal});
   if(!r.ok||r.redirected||!r.body){await r.body?.cancel();throw Error('R2_PUBLIC_READ_UNKNOWN');}
   const bytes=await boundedBytes(r.body as unknown as AsyncIterable<Uint8Array>,object.sizeBytes,signal);
   return {status:'found' as const,bytes,contentType:(r.headers.get('content-type')??'').split(';')[0]!.trim(),cacheControl:r.headers.get('cache-control')??''};
  },
  close(){closed=true;client.destroy();}
 });
}
