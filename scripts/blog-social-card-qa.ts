import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {deterministicBlogSocialCard,SharpCanonicalMediaProcessor,generatePublicDeliveryMaster} from '@xpotato/media-ingest';
const root=resolve('.'),out=join(root,'.local/blog-design/selected-c');await mkdir(out,{recursive:true});
const previous=JSON.parse(await readFile(join(root,'tests/fixtures/blog-foundation/social-card-titles.json'),'utf8')).cases as {id:string;title:string;cardDisplay?:{lines:string[]};expectedError?:string}[];
const cases=[...previous.map(item=>item.id==='combining-space'?{...item,expectedError:'CARD_COMBINING_GLYPH_UNSUPPORTED'}:item),...['検証から始める、小さな電子工作','非同期処理の境界を考える（Node.jsとC++の実装比較）','Rust 2024とSQLiteで記録を残す','Cafe\u0301とUTF-8の文字を読む','写真で残す：ロボットの配線と組立手順'].map((title,i)=>({id:'selected-c-new-'+i,title}))];
const records=[];
for(let i=0;i<cases.length;i++){
 const item=cases[i]!,folder=join(out,String(i));await mkdir(folder,{recursive:true});
 try{
  const card=await deterministicBlogSocialCard({repositoryRoot:root,contentId:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),title:item.title,categoryLabel:'工作 / 3Dプリンタ',cardDisplay:item.cardDisplay});
  if(item.expectedError)throw Error('Expected title capacity error');
  const source=join(folder,'source.svg');await writeFile(source,card.svg);
  const canonical=await new SharpCanonicalMediaProcessor('canonical',folder).ingest({schemaVersion:1,sourcePath:source,target:{contentId:card.binding.contentId,semanticAssetId:'article-social'},kind:'diagram',profileId:'canonical-raster-srgb8-lossless-webp-v1',overwrite:false});
  const delivery=await generatePublicDeliveryMaster(canonical,'social-card-v1','delivery',folder),png=await readFile(join(folder,delivery.privateRelativePath));
  await writeFile(join(out,'card-'+i+'.png'),png);
  records.push({id:item.id,status:'rendered',title:item.title,alt:card.alt,binding:card.binding,derivationSha256:card.derivationSha256,canonical,delivery});
 }catch(error){
  if(!item.expectedError||!(error instanceof Error)||error.message!==item.expectedError)throw error;
  await unlink(join(out,'card-'+i+'.png')).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;});
  records.push({id:item.id,status:'rejected',error:error.message});
 }
}
await writeFile(join(out,'verification.json'),JSON.stringify({profileId:'xpotato-blog-social-c-v1',designSelected:true,productionEligible:false,records},null,2));
await writeFile(join(out,'index.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>C採用・標準SNSカード検証</title><style>body{margin:24px;background:#f0edf3;color:#15141d;font:16px system-ui}img{display:block;max-width:100%;height:auto}figure{margin:24px 0}h1{font-size:24px}p{max-width:70ch}</style><h1>C採用・標準SNSカード</h1><p>上下の紫帯とセリフ見出しを保持。実際のoutline生成・canonical処理・配信PNG変換の出力です。画像の公開承認・Registry登録・記事公開は行っていません。分類は比較用の例です。</p>'+records.map((r,i)=>r.status==='rendered'?'<figure><figcaption>'+r.id+'</figcaption><img src="card-'+i+'.png" width="1200" height="630"></figure>':'').join(''));
console.log(JSON.stringify({out,rendered:records.filter(r=>r.status==='rendered').length,rejected:records.filter(r=>r.status==='rejected').length}));
