import {groupFactorPowers} from '../core/factor-powers.mjs';
import {verifyStagedOutcome} from '../engine/staged-result.mjs';
const reasons={
 'time-budget':'時間制限に達しました。','host-timeout':'初期化を含む時間制限に達しました。',
 'operation-budget':'計算量の制限に達しました。','algorithm-range':'対応する計算範囲の外です。',
 'algorithm-exhausted':'有限の探索枠で因子が見つかりませんでした。','algorithm-resource':'計算資源の制限に達しました。',
 cancelled:'計算を中止しました。'
};
export function makeResultView(value,input){
 const result=verifyStagedOutcome(value,input);
 const groups=groupFactorPowers(result.factors.map(f=>BigInt(f.value))).map(({base,exponent})=>({
  base:base.toString(),exponent,certainty:result.factors.some(f=>f.value===base.toString()&&f.certainty==='probable')?'probable':'proven'
 }));
 const unresolved=['incomplete','cancelled'].includes(result.status),residual=unresolved?result.remaining:null;
 const terms=groups.map(g=>g.base+(g.exponent===1?'':'^'+g.exponent));
 const spoken=groups.map(g=>g.base+(g.exponent===1?'':'の'+g.exponent+'乗'));
 if(residual!==null){terms.push('[未解決: '+residual+']');spoken.push('未解決の余因子 '+residual);}
 if(result.status==='neither'){terms.push(input);spoken.push(input);}
 let statusText;
 if(result.status==='neither')statusText=input+'は素数でも合成数でもありません。';
 else if(result.status==='complete')statusText=result.primality==='proven-prime'?'素数です（確定判定）。':'分解完了（すべて確定判定）。';
 else if(result.status==='probable')statusText='未証明の因子を含みます。probable判定は素数証明ではありません。';
 else if(result.status==='cancelled')statusText='中止しました。受信済みの結果だけを表示しています。';
 else statusText='未完了です。未解決の余因子は素数とは限りません。';
 const equation=input+' = '+terms.join(' × '),speech=input+' は '+spoken.join(' × ');
 const reasonText=reasons[result.reason]??'';
 const certaintyText=groups.map(g=>g.base+': '+(g.certainty==='proven'?'確定判定':'未証明（probable）')).join('、');
 return{input,status:result.status,groups,residual,equation,speech,statusText,reasonText,certaintyText,
  copyText:[equation,statusText,reasonText,certaintyText?'因子の確度: '+certaintyText:''].filter(Boolean).join('\n')};
}
