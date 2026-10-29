// SPDX-License-Identifier: AGPL-3.0-only
import {isVerifiedRoutingResult,isRoutingPresentationResult} from '../routing/verification.mjs';
import {stopReasonPresentation} from './progress.mjs';
// A failed/cancelled proof may retain an exact prefix with unknown prime certainty.
export function makeRoutingView(result,input){
 if(!isRoutingPresentationResult(result,input))throw Error('Routing view identity');
 const certified=isVerifiedRoutingResult(result,input);
 if(!certified&&result.certaintyVerified!==false)throw Error('Routing view certainty');
 const groups=(certified?result.verifiedFactors:[]).map(f=>({base:f.value,exponent:f.exponent,certainty:f.certainty}));
 const pending=certified?result.pendingGroups:[...result.snapshot.factors,...(!['0','1'].includes(result.snapshot.remaining)?[{value:result.snapshot.remaining,exponent:1}]:[])];
 const terms=groups.map(f=>f.base+(f.exponent===1?'':'^'+f.exponent));
 for(const f of pending)terms.push('[未分解・未確認: '+f.value+(f.exponent===1?'':'^'+f.exponent)+']');
 if(!terms.length)terms.push(input);
 const statusText=result.status==='neither'?input+'は素数でも合成数でもありません。':result.status==='complete'?'分解完了（すべて確定判定）。':result.status==='probable'?'未証明の因子を含みます。probable判定は素数証明ではありません。':result.status==='cancelled'?'中止しました。受理済みの部分結果を表示しています。':'未完了です。未分解・未確認の項を含みます。';
 const stops=[['計算',result.executionReason],['検算',result.verificationReason]].filter(([,code])=>code&&code!=='factor-proof-required');
 const reasonText=stops.map(([label,code])=>label+'：'+stopReasonPresentation(code).text).join(' ');
 const equation=input+' = '+terms.join(' × ');
 return{input,status:result.status,groups,residual:null,pendingGroups:pending,equation,statusText,reasonCode:null,reasonText,copyText:[equation,statusText,reasonText].filter(Boolean).join('\n')};
}
