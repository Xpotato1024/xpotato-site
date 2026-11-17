import {assertEditablePath,collectionFromPath,parseDraft,validateDraft,documentHandoff,type TaxonomySnapshot} from './draft.js';
export interface GitRequest {method:string;path:string;body?:unknown}
export type GitTransport=<T>(request:GitRequest)=>Promise<T>;
export class GitError extends Error {constructor(public readonly code:string,public readonly status=400){super(code);this.name='GitError';}}
const shaPattern=/^[a-f0-9]{40}$/u;
export const defaultRepository='Xpotato1024/xpotato-site';
export const editorManifestPath='content/registry/editor.json';
export function assertBranch(ref:string):void {
 if(!ref||ref.length>180||/^[./]|[./]$|\.\.|@\{|[\s~^:?*\[\]\\\x00-\x1f\x7f]/u.test(ref)||ref.includes('//')||ref.split('/').some(p=>p.startsWith('.')||p.endsWith('.lock')))throw new GitError('BRANCH_INVALID');
}
export function assertWorkingBranch(ref:string):void {assertBranch(ref);if(!ref.startsWith('content/')||ref.slice(8).length===0)throw new GitError('PROTECTED_BRANCH',403);}
export function assertSha(value:string):void {if(!shaPattern.test(value))throw new GitError('COMMIT_INVALID');}
const segment=encodeURIComponent;
function utf8Base64(value:string):string {let binary='';for(const byte of new TextEncoder().encode(value))binary+=String.fromCharCode(byte);return btoa(binary);}
function fromBase64(value:string):string {const bytes=Uint8Array.from(atob(value.replace(/\s/gu,'')),c=>c.charCodeAt(0));return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
export function createGitHubTransport(token:string,repository=defaultRepository,fetcher:typeof fetch=fetch):GitTransport {
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)||!token)throw new GitError('GITHUB_CONFIGURATION',503);
 return async<T>({method,path,body}:GitRequest):Promise<T>=>{
  if(!path.startsWith('/')||path.startsWith('//'))throw new GitError('API_PATH_INVALID');
  const result=await fetcher('https://api.github.com/repos/'+repository+path,{method,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Xpotato-Editor','Authorization':'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!result.ok)throw new GitError(result.status===409||result.status===422?'GIT_CONFLICT':result.status===404?'GIT_NOT_FOUND':result.status===401?'AUTH_EXPIRED':result.status===403?'GIT_FORBIDDEN':'GITHUB_FAILED',result.status);
  if(result.status===204)return undefined as T;
  return await result.json() as T;
 };
}
export interface GitSnapshot {branch:string;commit:string}
export interface GitDocument {path:string;source:string;blobSha:string;snapshot:GitSnapshot}
interface GitCommit {sha:string;tree:{sha:string};parents:{sha:string}[]}
interface GitTree {sha:string;truncated?:boolean;tree:{path:string;mode:string;type:string;sha:string;size?:number}[]}
interface GitContent {type:string;encoding:string;content:string;sha:string;size:number}
interface GitPR {number:number;html_url:string;draft:boolean;head:{ref:string;sha:string};base:{ref:string}}
export class GitRepository {
 constructor(private readonly api:GitTransport,readonly repository=defaultRepository){}
 async branches():Promise<string[]>{
  const result:string[]=[];for(let page=1;page<=20;page++){const values=await this.api<{name:string}[]>({method:'GET',path:'/branches?per_page=100&page='+page});result.push(...values.map(v=>v.name));if(values.length<100)return result;}
  throw new GitError('BRANCH_LIST_LIMIT');
 }
 async snapshot(branch:string):Promise<GitSnapshot>{assertBranch(branch);const data=await this.api<{object:{sha:string}}>({method:'GET',path:'/git/ref/heads/'+branch.split('/').map(segment).join('/')});assertSha(data.object.sha);return {branch,commit:data.object.sha};}
 async manifest(snapshot:GitSnapshot):Promise<TaxonomySnapshot>{
  assertSha(snapshot.commit);const content=await this.api<GitContent>({method:'GET',path:'/contents/'+editorManifestPath+'?ref='+snapshot.commit});
  if(content.type!=='file'||content.encoding!=='base64'||content.size>256*1024)throw new GitError('EDITOR_CONTRACT_INVALID');
  const value=JSON.parse(fromBase64(content.content)) as TaxonomySnapshot;
  if(value.contractVersion!==1||!value.categories||!Array.isArray(value.tags)||!Array.isArray(value.modules))throw new GitError('EDITOR_CONTRACT_VERSION_UNSUPPORTED');
  return value;
 }
 async documents(snapshot:GitSnapshot):Promise<{path:string;sha:string;bytes:number}[]>{
  assertSha(snapshot.commit);const tree=await this.api<GitTree>({method:'GET',path:'/git/trees/'+snapshot.commit+'?recursive=1'});
  if(tree.truncated)throw new GitError('CONTENT_TREE_TRUNCATED');
  return tree.tree.filter(row=>row.type==='blob'&&row.mode==='100644'&&/^content\/(articles|notes|projects|tools|pages)\/[^/]+\.mdx?$/u.test(row.path)).map(row=>({path:row.path,sha:row.sha,bytes:row.size??0}));
 }
 async read(snapshot:GitSnapshot,file:string):Promise<GitDocument>{
  assertEditablePath(file);assertSha(snapshot.commit);
  const content=await this.api<GitContent>({method:'GET',path:'/contents/'+file+'?ref='+snapshot.commit});
  if(content.type!=='file'||content.encoding!=='base64'||content.size>512*1024)throw new GitError('CONTENT_INVALID');
  return {path:file,source:fromBase64(content.content),blobSha:content.sha,snapshot};
 }
 async createBranch(source:GitSnapshot,target:string):Promise<GitSnapshot>{
  assertWorkingBranch(target);assertBranch(source.branch);assertSha(source.commit);
  const result=await this.api<{object:{sha:string}}>({method:'POST',path:'/git/refs',body:{ref:'refs/heads/'+target,sha:source.commit}});
  return {branch:target,commit:result.object.sha};
 }
 async save(input:{branch:string;expectedHead:string;path:string;source:string;message?:string;producer:'human'|'ai'|'mixed'}):Promise<{commit:string;blobSha:string;handoff:ReturnType<typeof documentHandoff>}>{
  assertWorkingBranch(input.branch);assertSha(input.expectedHead);assertEditablePath(input.path);
  if(!['human','ai','mixed'].includes(input.producer))throw new GitError('PRODUCER_INVALID');
  const current=await this.snapshot(input.branch);if(current.commit!==input.expectedHead)throw new GitError('GIT_CONFLICT',409);
  const {data}=parseDraft(input.source);if(data.draft!==true)throw new GitError('DRAFT_ONLY',403);
  const manifest=await this.manifest(current),issues=validateDraft(input.source,collectionFromPath(input.path),manifest);if(issues.length)throw new GitError('DRAFT_INVALID: '+issues.join('; '));
  try{const before=await this.read(current,input.path);if(parseDraft(before.source).data.id!==data.id)throw new GitError('CONTENT_ID_IMMUTABLE');}catch(error){if(!(error instanceof GitError&&error.code==='GIT_NOT_FOUND'))throw error;}
  const commit=await this.api<GitCommit>({method:'GET',path:'/git/commits/'+current.commit});
  const blob=await this.api<{sha:string}>({method:'POST',path:'/git/blobs',body:{encoding:'base64',content:utf8Base64(input.source)}});
  const tree=await this.api<{sha:string}>({method:'POST',path:'/git/trees',body:{base_tree:commit.tree.sha,tree:[{path:input.path,mode:'100644',type:'blob',sha:blob.sha}]}});
  const created=await this.api<{sha:string}>({method:'POST',path:'/git/commits',body:{message:(input.message?.slice(0,160)||'content: '+data.title)+'\n\nContent-Id: '+data.id+'\nEditor-Producer: '+input.producer,tree:tree.sha,parents:[current.commit]}});
  // Non-fast-forward updates fail if another writer advanced the branch in the meantime.
  await this.api({method:'PATCH',path:'/git/refs/heads/'+input.branch.split('/').map(segment).join('/'),body:{sha:created.sha,force:false}});
  return {commit:created.sha,blobSha:blob.sha,handoff:documentHandoff(input.source,created.sha,input.path)};
 }
 async pullRequest(input:{branch:string;base:string;title:string;contentId:string}):Promise<{number:number;url:string;draft:boolean}>{
  assertWorkingBranch(input.branch);assertBranch(input.base);if(input.branch===input.base)throw new GitError('PR_BASE_INVALID');
  const head=this.repository.split('/')[0]+':'+input.branch;
  const found=await this.api<GitPR[]>({method:'GET',path:'/pulls?state=open&head='+segment(head)+'&base='+segment(input.base)});
  const pr=found[0]??await this.api<GitPR>({method:'POST',path:'/pulls',body:{head:input.branch,base:input.base,title:input.title.slice(0,200),draft:true,body:'## 記事制作・レビュー\n\nContentId: '+input.contentId+'\n\nこのPRの本文は制作途中です。公開Gitの履歴として第三者にも閲覧できます。\n\n- [ ] 本文・図版・出典の確認\n- [ ] 該当する権利・プライバシー確認\n- [ ] 固定候補の本人承認\n- [ ] 正式な媒体保存・公開経路\n\nAIへの引継ぎはこのブランチの最新commitを読み、既存原稿を維持して追pushしてください。CMS保存・PR作成は公開承認ではありません。'}});
  return {number:pr.number,url:pr.html_url,draft:pr.draft};
 }
 async checks(commit:string):Promise<unknown>{assertSha(commit);return this.api({method:'GET',path:'/commits/'+commit+'/check-runs?per_page=100'});}
}
