import {createHash} from 'node:crypto';

// The migration snapshot remains immutable. These exact source candidates require
// ordinary PR review/merge/deployment; this list is not publication approval.
export const preservedPrimeContentSha256='a01bb693c1db5bdba77eba8ece2f8c5eadf36134bd844ff748161d8ab6257bdd';
const preservedDescription='大きな整数をブラウザ内で素因数分解。結果コピー、実行条件の調整・中止に対応。入力値・結果は外部送信しません。';
export const primeEditorialCandidates=Object.freeze([
 Object.freeze({contentSha256:'721418924289fcee6e5bacdf37c9d1cdd06c57b896af36f028b31b3db43b438d',
  description:'WebAssemblyと並列計算を活用し、ブラウザ内で高速に素因数分解。結果コピー、実行条件の調整・中止に対応。入力値・結果は外部送信しません。',
  reviewDocument:'docs/acceptance/ios-brave-copy-share-20261031.md'}),
 Object.freeze({contentSha256:'e6089119139c2e991ae4290d2a57734a6200bc82f0ab3fd0b7e55c3d6641e329',
  description:'WebAssemblyと並列計算を活用し、ブラウザ内で高速に素因数分解。結果コピー、実行条件の調整・中止に対応。入力値・結果は外部送信しません。',
  reviewDocument:'docs/acceptance/prime-share-help-removal-20261101.md'}),
 Object.freeze({contentSha256:'ce7371740734fcb191040c99af57167bac8ec9fb890f40bb7b711695525f9fc2',
  title:'素因数分解計算機',
  description:'整数を入力して素因数分解の結果を確認できる計算機。WebAssemblyと並列計算を活用し、ブラウザ内で高速に計算します。結果コピー、実行条件の調整・中止に対応。入力値・結果は外部送信しません。',
  reviewDocument:'docs/acceptance/prime-factorizer-seo-20261102.md'})
]);

// A title exception is bound to the entire reviewed MDX, never to a free-form title.
export function reviewedPrimeTitle(page:string):string|undefined {
 const actual=createHash('sha256').update(page).digest('hex');
 const candidate=primeEditorialCandidates.find(candidate=>candidate.contentSha256===actual);
 return candidate&&'title' in candidate?candidate.title:undefined;
}

export function checkedPreservedPrimeDescription(page:string,baselineSha256:string,baselineDescription:string):string {
 const fail=():never=>{throw Error('Preserved Prime content changed; explicit editorial review required');};
 if(baselineSha256!==preservedPrimeContentSha256||baselineDescription!==preservedDescription)return fail();
 const actual=createHash('sha256').update(page).digest('hex');
 if(actual===preservedPrimeContentSha256)return baselineDescription;
 return primeEditorialCandidates.find(candidate=>candidate.contentSha256===actual)?.description??fail();
}
