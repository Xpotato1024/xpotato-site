import {mediaPolicy,sniffMedia,type MediaKind} from './policy.js';
export interface ImageInspection {mime:string;width:number;height:number;frames:number;durationMs:number;animated:boolean}
export function inspectImage(bytes:Uint8Array,kind:MediaKind|null):ImageInspection {
 const mime=sniffMedia(bytes),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const ascii=(a:number,b:number)=>String.fromCharCode(...bytes.slice(a,b));
 let width=0,height=0,frames=1,durationMs=0,animated=false;
 const require=(condition:unknown)=>{if(!condition)throw Error('MEDIA_CONTAINER_INVALID');};
 if(mime==='image/png'){
  require(bytes.length>=33&&ascii(12,16)==='IHDR');width=view.getUint32(16);height=view.getUint32(20);
  let offset=8;while(offset+12<=bytes.length){const size=view.getUint32(offset);require(size<=bytes.length-offset-12);const type=ascii(offset+4,offset+8);if(type==='acTL')throw Error('APNG_NOT_SUPPORTED');offset+=size+12;if(type==='IEND'){require(offset===bytes.length);break;}}
 }else if(mime==='image/jpeg'){
  let offset=2;while(offset+4<=bytes.length){require(bytes[offset]===255);while(bytes[offset]===255)offset++;const marker=bytes[offset++]!;if(marker===217||marker===218)break;if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;const length=view.getUint16(offset);require(length>=2&&offset+length<=bytes.length);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){require(length>=7);height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}offset+=length;}
 }else if(mime==='image/gif'){
  require(bytes.length>=14);width=view.getUint16(6,true);height=view.getUint16(8,true);let offset=13+((bytes[10]!&128)?3*2**((bytes[10]!&7)+1):0);frames=0;let delay=100,ended=false;
  const blocks=()=>{while(offset<bytes.length){const size=bytes[offset++]!;if(size===0)return;require(offset+size<=bytes.length);offset+=size;}throw Error('MEDIA_CONTAINER_INVALID');};
  while(offset<bytes.length){const marker=bytes[offset++]!;if(marker===0x3b){ended=true;break;}if(marker===0x21){require(offset<bytes.length);const label=bytes[offset++]!;if(label===0xf9){require(bytes[offset]===4&&offset+6<=bytes.length);delay=view.getUint16(offset+2,true)*10||100;}blocks();continue;}require(marker===0x2c&&offset+9<=bytes.length);const fw=view.getUint16(offset+4,true),fh=view.getUint16(offset+6,true);require(fw>0&&fh>0&&fw<=width&&fh<=height);const packed=bytes[offset+8]!;offset+=9;if(packed&128)offset+=3*2**((packed&7)+1);require(offset<bytes.length);offset++;blocks();frames++;durationMs+=delay;delay=100;if(frames>mediaPolicy.maxFrames)throw Error('ANIMATION_FRAME_LIMIT');}
  require(ended&&offset===bytes.length&&frames>0);animated=frames>1;
 }else if(mime==='image/webp'){
  require(bytes.length>=20&&view.getUint32(4,true)+8===bytes.length);let offset=12;frames=0;
  const u24=(i:number)=>bytes[i]!+(bytes[i+1]!<<8)+(bytes[i+2]!<<16);
  while(offset+8<=bytes.length){const size=view.getUint32(offset+4,true),type=ascii(offset,offset+4),data=offset+8;require(data+size<=bytes.length);
   if(type==='VP8X'){require(size>=10);width=u24(data+4)+1;height=u24(data+7)+1;animated=Boolean(bytes[data]!&2);}
   if(type==='ANMF'){require(size>=16);frames++;durationMs+=u24(data+12);}
   if(!width&&type==='VP8 '){require(size>=10&&ascii(data+3,data+6)==='\x9d\x01\x2a');width=view.getUint16(data+6,true)&0x3fff;height=view.getUint16(data+8,true)&0x3fff;}
   if(!width&&type==='VP8L'){require(size>=5&&bytes[data]===0x2f);const bits=view.getUint32(data+1,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
   offset=data+size+(size%2);
  }
  require(offset===bytes.length);if(animated)require(frames>0);else frames=1;
 }else throw Error('HEIC_CONVERSION_REQUIRED');
 require(width>0&&height>0&&width<=mediaPolicy.maxDimension&&height<=mediaPolicy.maxDimension);
 if(width*height*frames>mediaPolicy.maxPixels||frames>mediaPolicy.maxFrames||durationMs>mediaPolicy.maxDurationMs)throw Error('MEDIA_DECODE_BUDGET');
 if(animated&&kind!==null&&kind!=='animation')throw Error('ANIMATION_PROFILE_REQUIRED');
 if(kind==='animation'&&!animated)throw Error('ANIMATION_REQUIRED');
 return {mime,width,height,frames,durationMs,animated};
}
