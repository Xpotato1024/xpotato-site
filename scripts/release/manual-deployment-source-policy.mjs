import {stop} from './manual-deployment-provider.mjs';
// Exact reviewed guard replacement only; never exclude the package or arbitrary edits.
export const repositoryGuardPath='site-validators/src/repository-cli.ts';
export const oldRepositoryGuardBlob='e9b617c08aae4f9c9fd3eccc3f9fa4d89748e0ed';
export const reviewedRepositoryGuardBlob='a04827bb3e8c3a26a17e7edf1a1fb18ae2568290';
export function assertPackageSourceParity(trees) {
  if(!Array.isArray(trees)||trees.length!==2)stop('PACKAGE_SOURCE_INCOMPLETE');
  const rows=trees.map(body=>{
    if(body?.truncated!==false||!Array.isArray(body.tree)||new Set(body.tree.map(r=>r?.path)).size!==body.tree.length||body.tree.some(r=>typeof r?.path!=='string'||!(/^[a-f0-9]{40}$/).test(r.sha)||r.type==='tree'&&r.mode!=='040000'))stop('PACKAGE_SOURCE_INCOMPLETE');
    return body.tree.filter(r=>r.type!=='tree');
  });
  const guard=rows.map(list=>list.filter(r=>r.path===repositoryGuardPath));
  if(guard.some(list=>list.length!==1||list[0].type!=='blob'||list[0].mode!=='100644'))stop('REPOSITORY_GUARD_PATH_OR_MODE');
  const remaining=rows.map(list=>JSON.stringify(list.filter(r=>r.path!==repositoryGuardPath).map(r=>[r.path,r.mode,r.type,r.sha]).sort((a,b)=>a[0].localeCompare(b[0]))));
  if(remaining[0]!==remaining[1])stop('PUBLIC_PACKAGE_INPUTS_CHANGED');
  const [old,current]=guard.map(list=>list[0].sha);
  if(old===current)return {repositoryGuard:'UNCHANGED'};
  if(old!==oldRepositoryGuardBlob||current!==reviewedRepositoryGuardBlob)stop('UNREVIEWED_REPOSITORY_GUARD_CHANGE');
  return {repositoryGuard:'EXACT_REVIEWED_MANUAL_BOUNDARY_MIGRATION'};
}
