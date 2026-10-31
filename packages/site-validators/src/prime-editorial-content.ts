import {createHash} from 'node:crypto';

// The migration snapshot remains immutable. These exact source candidates require
// ordinary PR review/merge/deployment; this list is not publication approval.
export const preservedPrimeContentSha256='a01bb693c1db5bdba77eba8ece2f8c5eadf36134bd844ff748161d8ab6257bdd';
const preservedDescription='大きな整数をブラウザ内で素因数分解。結果コピー、実行条件の調整・中止に対応。入力値・結果は外部送信しません。';
export const primeEditorialCandidates=Object.freeze([
 Object.freeze({contentSha256:'721418924289fcee6e5bacdf37c9d1cdd06c57b896af36f028b31b3db43b438d',
  description:'WebAssemblyと並列計算を活用し、ブラウザ内で高速に素因数分解。結果コピー、実行条件の調整・中止に対応。入力値・結果は外部送信しません。',
  reviewDocument:'docs/acceptance/ios-brave-copy-share-20261031.md'})
]);

export function checkedPreservedPrimeDescription(page:string,baselineSha256:string,baselineDescription:string):string {
 const fail=():never=>{throw Error('Preserved Prime content changed; explicit editorial review required');};
 if(baselineSha256!==preservedPrimeContentSha256||baselineDescription!==preservedDescription)return fail();
 const actual=createHash('sha256').update(page).digest('hex');
 if(actual===preservedPrimeContentSha256)return baselineDescription;
 return primeEditorialCandidates.find(candidate=>candidate.contentSha256===actual)?.description??fail();
}
