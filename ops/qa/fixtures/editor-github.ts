import {createHash} from 'node:crypto';
import {GitError,GitRepository,type GitRequest,type GitTransport} from '../../../packages/editor-core/src/git.js';
interface Commit {sha:string;tree:{sha:string};parents:{sha:string}[];message:string}
interface Tree {sha:string;tree:{path:string;mode:string;type:string;sha:string;size:number}[]}
/** Test-only transport. No GitHub network or actual repository writes. */
export class EditorGitHubFixture {
 readonly calls:GitRequest[]=[];
 readonly blobs=new Map<string,string>();readonly trees=new Map<string,Tree>();readonly commits=new Map<string,Commit>();readonly refs=new Map<string,string>();readonly pulls:{number:number;html_url:string;draft:boolean;head:{ref:string;sha:string};base:{ref:string}}[]=[];
 readonly repository:GitRepository;private sequence=0;
 constructor(readonly manifest:unknown){const tree=this.tree({});const commit=this.commit(tree.sha,[], 'synthetic initial');this.refs.set('main',commit.sha);this.repository=new GitRepository(this.request,'fixture/editor');}
 private hash(value:unknown){return createHash('sha1').update(JSON.stringify(value)).digest('hex');}
 private blob(source:string){const sha=this.hash({source});this.blobs.set(sha,source);return sha;}
 private tree(files:Record<string,string>){const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,sha])=>({path,sha,mode:'100644',type:'blob',size:Buffer.byteLength(this.blobs.get(sha)??'')}));const sha=this.hash(entries),tree={sha,tree:entries};this.trees.set(sha,tree);return tree;}
 private commit(tree:string,parents:string[],message:string){const sha=this.hash({tree,parents,message,sequence:++this.sequence}),commit={sha,tree:{sha:tree},parents:parents.map(sha=>({sha})),message};this.commits.set(sha,commit);return commit;}
 readonly request:GitTransport=async<T>(request:GitRequest):Promise<T>=>{
  this.calls.push(request);const url=new URL(request.path,'https://fixture.invalid'),pathname=decodeURIComponent(url.pathname),body=request.body as Record<string,unknown>|undefined;let result:unknown;
  if(pathname==='/branches')result=[...this.refs.keys()].map(name=>({name}));
  else if(pathname.startsWith('/git/ref/heads/')){const sha=this.refs.get(pathname.slice('/git/ref/heads/'.length));if(!sha)throw new GitError('GIT_NOT_FOUND',404);result={object:{sha}};}
  else if(pathname==='/git/refs'&&request.method==='POST'){const ref=String(body?.ref).replace(/^refs\/heads\//u,''),sha=String(body?.sha);if(this.refs.has(ref)||!this.commits.has(sha))throw new GitError('GIT_CONFLICT',422);this.refs.set(ref,sha);result={object:{sha}};}
  else if(pathname.startsWith('/contents/')){const file=pathname.slice('/contents/'.length),ref=url.searchParams.get('ref')??'',commit=this.commits.get(ref);if(!commit)throw new GitError('GIT_NOT_FOUND',404);let source:string,sha:string;
   if(file==='content/registry/editor.json'){source=JSON.stringify(this.manifest);sha=this.hash(source);}else{const entry=this.trees.get(commit.tree.sha)?.tree.find(e=>e.path===file);if(!entry)throw new GitError('GIT_NOT_FOUND',404);sha=entry.sha;source=this.blobs.get(sha)!;}
   result={type:'file',encoding:'base64',content:Buffer.from(source).toString('base64'),sha,size:Buffer.byteLength(source)};
  }else if(pathname.startsWith('/git/trees/')&&request.method==='GET'){const ref=pathname.slice('/git/trees/'.length),tree=this.trees.get(this.commits.get(ref)?.tree.sha??ref);if(!tree)throw new GitError('GIT_NOT_FOUND',404);result={...tree,truncated:false};}
  else if(pathname.startsWith('/git/commits/')&&request.method==='GET'){result=this.commits.get(pathname.slice('/git/commits/'.length));if(!result)throw new GitError('GIT_NOT_FOUND',404);}
  else if(pathname==='/git/blobs'&&request.method==='POST'){if(body?.encoding!=='base64')throw Error('FIXTURE_ENCODING');result={sha:this.blob(Buffer.from(String(body.content),'base64').toString('utf8'))};}
  else if(pathname==='/git/trees'&&request.method==='POST'){const base=this.trees.get(String(body?.base_tree));if(!base)throw Error('FIXTURE_BASE_TREE');const files=Object.fromEntries(base.tree.map(e=>[e.path,e.sha]));for(const entry of body?.tree as {path:string;sha:string}[])files[entry.path]=entry.sha;result=this.tree(files);}
  else if(pathname==='/git/commits'&&request.method==='POST')result=this.commit(String(body?.tree),body?.parents as string[],String(body?.message));
  else if(pathname.startsWith('/git/refs/heads/')&&request.method==='PATCH'){const ref=pathname.slice('/git/refs/heads/'.length),commit=this.commits.get(String(body?.sha));if(body?.force!==false||!commit||commit.parents[0]?.sha!==this.refs.get(ref))throw new GitError('GIT_CONFLICT',422);this.refs.set(ref,commit.sha);result={object:{sha:commit.sha}};}
  else if(pathname==='/pulls'&&request.method==='GET')result=this.pulls.filter(p=>p.head.ref===(url.searchParams.get('head')??'').split(':').slice(1).join(':')&&p.base.ref===url.searchParams.get('base'));
  else if(pathname==='/pulls'&&request.method==='POST'){const ref=String(body?.head),pr={number:this.pulls.length+1,html_url:'https://github.com/fixture/editor/pull/'+(this.pulls.length+1),draft:body?.draft===true,head:{ref,sha:this.refs.get(ref)!},base:{ref:String(body?.base)}};this.pulls.push(pr);result=pr;}
  else if(/^\/commits\/[a-f0-9]{40}\/check-runs$/u.test(pathname))result={total_count:0,check_runs:[]};
  else throw Error('UNEXPECTED_FIXTURE_REQUEST '+request.method+' '+pathname);
  return result as T;
 };
}
