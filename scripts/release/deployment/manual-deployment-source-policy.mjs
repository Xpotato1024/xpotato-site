import {stop} from './manual-deployment-provider.mjs';
// Historical path/blob exceptions stay immutable. Current owners require exact
// source equality; a directory move is never permission to reuse an old build.
export const repositoryGuardPath='site-validators/src/repository-cli.ts';
export const oldRepositoryGuardBlob='e9b617c08aae4f9c9fd3eccc3f9fa4d89748e0ed';
export const reviewedRepositoryGuardBlob='a04827bb3e8c3a26a17e7edf1a1fb18ae2568290';
export const reviewedGuardTransitions=Object.freeze({"site-validators/src/repository-cli.ts":["e9b617c08aae4f9c9fd3eccc3f9fa4d89748e0ed","a04827bb3e8c3a26a17e7edf1a1fb18ae2568290"],"site-validators/src/phase7-interactive-readiness.ts":["6e24d5657310461603de4cb0fa56b868681c000a","e15eddc91b2b23564fbb66a8d5983d9015889c3e"],"site-validators/src/phase8-route-discovery-readiness.ts":["5dd416722928c933f9a4a1a20c793e370956ed53","e7a3151ef9626c20b89cb35e01e8b5095c3f2f8d"],"content-contracts/src/phase7-interactive.ts":["d44630eb2ab3a3478accb4a5c963a125b2963cf7","129efc236d285117db34af7e2569fabfb356dd99"]});
export const reviewedSchemaTreePair=Object.freeze(["8054fcfb55e0e38c71d39d402ae61ed426adb8b9", "5b071ae4e8cef249356451e02b71861587d556d7"]);
export const currentGuardPaths=Object.freeze([repositoryGuardPath,
  'site-validators/src/migration/phase7-interactive-readiness.ts',
  'site-validators/src/migration/phase8-route-discovery-readiness.ts',
  'content-contracts/src/migration/phase7-interactive.ts']);
const historicalGuardPaths=Object.keys(reviewedGuardTransitions);
const order=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0;
function entries(body,code) {
  const rows=body?.tree;
  if(body?.truncated!==false||!Array.isArray(rows)||new Set(rows.map(r=>r?.path)).size!==rows.length||rows.some(r=>
    typeof r?.path!=='string'||!r.path||/[\\\0\r\n]/.test(r.path)||r.path.split('/').some(p=>!p||p==='.'||p==='..')||
    !/^[a-f0-9]{40}$/.test(r.sha)||!(r.type==='tree'&&r.mode==='040000'||r.type==='blob'&&['100644','100755'].includes(r.mode))))stop(code);
  return rows;
}
const signature=rows=>JSON.stringify(rows.map(r=>[r.path,r.mode,r.type,r.sha]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0));
function guardLayout(rows) {
  const has=path=>rows.some(r=>r.path===path),regular=path=>rows.some(r=>r.path===path&&r.type==='blob'&&r.mode==='100644');
  if(currentGuardPaths.every(regular)&&historicalGuardPaths.filter(path=>path!==repositoryGuardPath).every(path=>!has(path)))return 'current';
  if(historicalGuardPaths.every(regular)&&currentGuardPaths.filter(path=>path!==repositoryGuardPath).every(path=>!has(path)))return 'legacy';
  stop('REPOSITORY_GUARD_PATH_OR_MODE');
}
export function assertPackageSourceParity(trees) {
  if(!Array.isArray(trees)||trees.length!==2)stop('PACKAGE_SOURCE_INCOMPLETE');
  const rows=trees.map(body=>entries(body,'PACKAGE_SOURCE_INCOMPLETE').filter(r=>r.type!=='tree'));
  const layouts=rows.map(guardLayout);
  if(layouts[0]!==layouts[1])stop('PUBLIC_PACKAGE_INPUTS_CHANGED');
  if(layouts[0]==='current') {
    if(currentGuardPaths.some(path=>rows[0].find(r=>r.path===path).sha!==rows[1].find(r=>r.path===path).sha))stop('UNREVIEWED_REPOSITORY_GUARD_CHANGE');
    if(signature(rows[0])!==signature(rows[1]))stop('PUBLIC_PACKAGE_INPUTS_CHANGED');
    return {repositoryGuard:'UNCHANGED',layout:'current'};
  }
  let migrated=false;
  for(const [path,[before,after]] of Object.entries(reviewedGuardTransitions)) {
    const guard=rows.map(list=>list.filter(r=>r.path===path));
    if(guard.some(list=>list.length!==1||list[0].type!=='blob'||list[0].mode!=='100644'))stop('REPOSITORY_GUARD_PATH_OR_MODE');
    const [old,current]=guard.map(list=>list[0].sha);
    if(old===current)continue;
    if(old!==before||current!==after)stop('UNREVIEWED_REPOSITORY_GUARD_CHANGE');
    migrated=true;
  }
  const remaining=rows.map(list=>JSON.stringify(list.filter(r=>!Object.hasOwn(reviewedGuardTransitions,r.path)).map(r=>[r.path,r.mode,r.type,r.sha]).sort((a,b)=>a[0].localeCompare(b[0]))));
  if(remaining[0]!==remaining[1])stop('PUBLIC_PACKAGE_INPUTS_CHANGED');
  return {repositoryGuard:migrated?'EXACT_REVIEWED_MANUAL_BOUNDARY_MIGRATION':'UNCHANGED',layout:'legacy'};
}

const commonRequired=Object.freeze({apps:'tree',schemas:'tree','package.json':'blob','package-lock.json':'blob','.node-version':'blob'});
const currentRequired=Object.freeze({config:'tree',tools:'tree',templates:'tree',vendor:'tree',tests:'tree',docs:'tree','.github':'tree',
  '.gitattributes':'blob','.gitignore':'blob','.nvmrc':'blob','tsconfig.base.json':'blob','tsconfig.json':'blob','vitest.config.ts':'blob'});
// Packages/scripts have their own exact comparisons. Workflow/approval and the
// two docs authority records are checked separately; prose is not a build input.
const separatelyChecked=new Set(['packages','scripts','docs','.github','.agents','README.md','AGENTS.md']);
export function assertBuildSourceParity(trees,layout) {
  if(!Array.isArray(trees)||trees.length!==2||!['current','legacy'].includes(layout))stop('SOURCE_TREE_INCOMPLETE');
  const rows=trees.map(tree=>entries({truncated:false,tree},'SOURCE_TREE_INCOMPLETE'));
  for(const list of rows)for(const [path,type]of Object.entries({...commonRequired,...(layout==='current'?currentRequired:{})})) {
    const entry=list.find(r=>r.path===path);
    if(!entry||entry.type!==type||entry.mode!==(type==='tree'?'040000':'100644'))stop('PUBLIC_BUILD_INPUTS_CHANGED');
  }
  for(const path of new Set(rows.flat().map(r=>r.path))) {
    if(separatelyChecked.has(path))continue;
    const [before,after]=rows.map(list=>list.find(r=>r.path===path));
    if(!before||!after||before.mode!==after.mode||before.type!==after.type||before.sha!==after.sha&&!(layout==='legacy'&&path==='schemas'&&before.sha===reviewedSchemaTreePair[0]&&after.sha===reviewedSchemaTreePair[1]))stop('PUBLIC_BUILD_INPUTS_CHANGED');
  }
}

const manualFiles=Object.freeze(['manual-deployment.mjs','manual-deployment-provider.mjs','manual-deployment-github.mjs','manual-deployment-public.mjs',
  'manual-deployment-process.mjs','manual-deployment-cli.mjs','manual-deployment-readiness.mjs','manual-deployment-workflow-policy.mjs','manual-deployment-source-policy.mjs']);
export const currentManualControlPaths=Object.freeze([...manualFiles.map(name=>'release/deployment/'+name),'release/artifact/Read-ManualArtifactHandoff.ps1']);
const manualControlPaths=new Set([...currentManualControlPaths,...manualFiles.map(name=>'release/'+name),'release/Read-ManualArtifactHandoff.ps1']);
export function assertScriptSourceParity(trees,layout) {
  if(!Array.isArray(trees)||trees.length!==2||!['current','legacy'].includes(layout))stop('SCRIPTS_TREE_INCOMPLETE');
  const rows=trees.map(tree=>entries(tree,'SCRIPTS_TREE_INCOMPLETE').filter(r=>r.type!=='tree'));
  if(layout==='current')for(const list of rows)for(const path of currentManualControlPaths) {
    if(!list.some(r=>r.path===path&&r.type==='blob'&&r.mode==='100644'))stop('MANUAL_CONTROL_PLANE_PATH_OR_MODE');
  }
  for(const list of rows)if(list.some(r=>manualControlPaths.has(r.path)&&r.mode!=='100644'))stop('MANUAL_CONTROL_PLANE_PATH_OR_MODE');
  const protectedRows=rows.map(list=>list.filter(r=>!r.path.endsWith('.test.mjs')&&!manualControlPaths.has(r.path)).sort(order));
  if(signature(protectedRows[0])!==signature(protectedRows[1]))stop('BUILD_OR_POLICY_SCRIPTS_CHANGED');
}
