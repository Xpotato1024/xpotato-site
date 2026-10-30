import {parseArgs} from 'node:util';import {resolve,relative,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {checkPrepublicationResearch} from '../packages/article-pipeline/src/prepublication-research.js';import {safeRead,safeReadBytes,immutable} from '../packages/article-pipeline/src/private-files.js';
const root=fileURLToPath(new URL('../',import.meta.url)),{values}=parseArgs({options:{snapshots:{type:'boolean',default:false},'citation-preview':{type:'boolean',default:false}}});
const p=JSON.parse(await safeRead(join(root,'docs/acceptance/articles/3d-print-strength-research.json'))),mdx=await safeRead(join(root,'tests/fixtures/article-concrete/article.mdx'));
let snapshots:Map<string,Uint8Array>|undefined;
if(values.snapshots){snapshots=new Map();const index=JSON.parse(await safeRead(join(root,'.local/article-research/private-files.json')));for(const [id,path] of Object.entries(index)){
 if(typeof path!=='string')throw Error('RESEARCH_PRIVATE_PATH_INVALID');const full=resolve(root,path),r=relative(root,full).replaceAll('\\','/');if(!r.startsWith('.local/article-research/raw/')&&!/^tests\/fixtures\/article-concrete\/[a-z-]+\.svg$/u.test(r))throw Error('RESEARCH_PRIVATE_PATH_INVALID');snapshots.set(id,await safeReadBytes(full,4194304));}}
const result=checkPrepublicationResearch(p,mdx,snapshots);
if(values['citation-preview'])await immutable(join(root,'.local/article-research/citation-proposal-'+result.citationCompilationSha256+'.md'),result.citationProposal);
const {citationProposal,citationManifest,...summary}=result;console.log(JSON.stringify(summary,null,2));
