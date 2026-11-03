/** Frozen release compatibility only. New candidate adoption never supplies
 * this context. Exact artifact + module bytes preserve old rollback without
 * admitting composed code for any new release. */
const composedWorkerArtifacts=new Set([
 '3bc767d94141cf362f184c41f0a55215f5f38ba17aa723a61101ecd6a639d90c',
 '7a57f42e7bbe17defd0d86458f18ebde8e2a257c5d643ec479cb032549e5d0fb',
]);
export function permitsHistoricalWorker(expectedArtifact:string|undefined,actualArtifact:string,path:string,name:string,moduleSha256:string){
 return expectedArtifact===actualArtifact&&composedWorkerArtifacts.has(actualArtifact)
  &&path==='src/routing/ecm-source.mjs'&&name==='ECM_WORKER_SOURCE'
  &&moduleSha256==='6a734a1b0c573394a61df8da57ac199b86a6344680cd642839b561d5e71d1e67';
}
