import {stop} from './manual-deployment-provider.mjs';
// Exact reviewed workflow-guard/schema transitions; every other package byte stays fixed.
// 共通menu別計測と任意schema項目のみ追従。過去manifestの実測本文は更新せず、他UI/package差分は引き続き停止する。
export const repositoryGuardPath='site-validators/src/repository-cli.ts';
export const oldRepositoryGuardBlob='e9b617c08aae4f9c9fd3eccc3f9fa4d89748e0ed';
export const reviewedRepositoryGuardBlob='a04827bb3e8c3a26a17e7edf1a1fb18ae2568290';
export const reviewedGuardTransitions=Object.freeze({"site-validators/src/repository-cli.ts":["e9b617c08aae4f9c9fd3eccc3f9fa4d89748e0ed","a04827bb3e8c3a26a17e7edf1a1fb18ae2568290"],"site-validators/src/phase7-interactive-readiness.ts":["6e24d5657310461603de4cb0fa56b868681c000a","e15eddc91b2b23564fbb66a8d5983d9015889c3e"],"site-validators/src/phase8-route-discovery-readiness.ts":["5dd416722928c933f9a4a1a20c793e370956ed53","e7a3151ef9626c20b89cb35e01e8b5095c3f2f8d"],"content-contracts/src/phase7-interactive.ts":["d44630eb2ab3a3478accb4a5c963a125b2963cf7","129efc236d285117db34af7e2569fabfb356dd99"]});
export const reviewedSchemaTreePair=Object.freeze(["8054fcfb55e0e38c71d39d402ae61ed426adb8b9", "5b071ae4e8cef249356451e02b71861587d556d7"]);
export function assertPackageSourceParity(trees) {
  if(!Array.isArray(trees)||trees.length!==2)stop('PACKAGE_SOURCE_INCOMPLETE');
  const rows=trees.map(body=>{
    if(body?.truncated!==false||!Array.isArray(body.tree)||new Set(body.tree.map(r=>r?.path)).size!==body.tree.length||body.tree.some(r=>typeof r?.path!=='string'||!(/^[a-f0-9]{40}$/).test(r.sha)||r.type==='tree'&&r.mode!=='040000'))stop('PACKAGE_SOURCE_INCOMPLETE');
    return body.tree.filter(r=>r.type!=='tree');
  });
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
  return {repositoryGuard:migrated?'EXACT_REVIEWED_MANUAL_BOUNDARY_MIGRATION':'UNCHANGED'};
}
