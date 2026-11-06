// SPDX-License-Identifier: AGPL-3.0-only
// Candidate contract only. Not imported by the public adapter or any engine.
import {parseIntegerInput} from './integer-input.mjs';

export const EXTENDED_INPUT_CANDIDATE=Object.freeze({
 schemaVersion:1,maxInputBits:1024,maxInputDigits:309,
 maxSiqsResidualBits:400,maxSiqsResidualDigits:121,smallRouteExclusiveBits:128,
 maxFactorGroups:1023,maxMultiplicity:1023,
 defaultValidationBudgetMs:25,maxValidationBudgetMs:100,executionEnabled:false
});
const cap=EXTENDED_INPUT_CANDIDATE,maximum=1n<<BigInt(cap.maxInputBits);
const smallMaximum=1n<<BigInt(cap.smallRouteExclusiveBits);
export class ExtendedInputContractError extends Error{
 constructor(code){super(code);this.name='ExtendedInputContractError';this.code=code;}
}
const fail=code=>{throw new ExtendedInputContractError(code);};
const bits=n=>n===0n?0:n.toString(2).length;
function canonicalValue(text,rangeCode='RESULT_VALUE_RANGE'){
 if(typeof text!=='string'||text.length>cap.maxInputDigits)fail(rangeCode);
 if(!/^(?:0|[1-9][0-9]*)$/.test(text))fail('CANONICAL_VALUE');
 const n=BigInt(text);if(n>=maximum)fail(rangeCode);return n;
}
function shape(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const own=Reflect.ownKeys(value);
 return own.length===keys.length&&own.every(key=>{
  if(typeof key!=='string'||!keys.includes(key))return false;
  const property=Object.getOwnPropertyDescriptor(value,key);return property&&Object.hasOwn(property,'value');
 });
}
export function inspectExtendedInput(raw){
 // The unchanged parser already bounds text, expansion and BigInt conversion.
 const {value,canonical}=parseIntegerInput(raw),bitCount=bits(value);
 if(canonical.length>cap.maxInputDigits||bitCount>cap.maxInputBits)fail('CANDIDATE_INPUT_RANGE');
 return Object.freeze({canonical,digits:canonical.length,bits:bitCount,
  kind:value===0n?'zero':value===1n?'unit':'integer',executionEnabled:false});
}
function inspection(input,n,remaining,remainingValue,factors,multiplicity){
 const remainingBits=bits(remainingValue);
 const residualClass=n<2n?'not-applicable':remainingValue===1n?'no-residual':
  remainingValue<smallMaximum?'small-residual-candidate':
  remainingBits<=cap.maxSiqsResidualBits&&remaining.length<=cap.maxSiqsResidualDigits?'siqs-residual-candidate':'outside-siqs-residual';
 return Object.freeze({input,remaining,remainingBits,factors:Object.freeze(factors),
  checkedMultiplicity:multiplicity,decompositionVerified:true,
  primalityVerified:false,factorizationComplete:false,disposalVerified:false,executionEnabled:false,
  residualClass,stopReason:residualClass==='outside-siqs-residual'?'siqs-residual-range':null});
}
export function inspectExtendedDecomposition(input,snapshot,{
 signal,budgetMs=cap.defaultValidationBudgetMs,now=()=>performance.now()
}={}){
 if(typeof now!=='function'||!Number.isSafeInteger(budgetMs)||budgetMs<1||budgetMs>cap.maxValidationBudgetMs)fail('VALIDATION_OPTIONS');
 const started=now();if(!Number.isFinite(started)||started<0)fail('VALIDATION_CLOCK');let last=started;
 const checkpoint=()=>{
  if(signal?.aborted)fail('VALIDATION_CANCELLED');
  const current=now();if(!Number.isFinite(current)||current<last)fail('VALIDATION_CLOCK');last=current;
  if(current-started>=budgetMs)fail('VALIDATION_TIME_BUDGET');
 };
 checkpoint();
 const n=canonicalValue(input,'CANDIDATE_INPUT_RANGE');
 if(!shape(snapshot,['factors','remaining'])||!Array.isArray(snapshot.factors))fail('RESULT_SHAPE');
 const sourceFactors=snapshot.factors,count=sourceFactors.length;
 if(!Number.isSafeInteger(count)||count<0||count>cap.maxFactorGroups)fail('FACTOR_COUNT');
 const remainingText=snapshot.remaining,remaining=canonicalValue(remainingText);
 if(n===0n){
  if(count||remaining!==0n)fail('ZERO_DECOMPOSITION');
  checkpoint();return inspection(input,n,remainingText,remaining,[],0);
 }
 if(remaining<1n||remaining>n)fail('ARITHMETIC_IDENTITY');
 let quotient=n,previous=1n,multiplicity=0;const factors=[];
 for(let index=0;index<count;index++){
  checkpoint();const entry=Object.getOwnPropertyDescriptor(sourceFactors,String(index));
  if(!entry||!Object.hasOwn(entry,'value'))fail('FACTOR_SHAPE');
  const factor=entry.value;if(!shape(factor,['value','exponent']))fail('FACTOR_SHAPE');
  const value=factor.value,exponent=factor.exponent,base=canonicalValue(value);
  if(base<2n||base<=previous)fail('FACTOR_ORDER');
  if(!Number.isSafeInteger(exponent)||exponent<1||exponent>cap.maxMultiplicity||multiplicity+exponent>cap.maxMultiplicity)fail('FACTOR_EXPONENT');
  // bitLength(base**exponent) >= exponent*(bitLength(base)-1)+1.
  // Reject impossible powers before exponentiation. Remaining powers stay bounded.
  if((bits(base)-1)*exponent+1>bits(quotient))fail('FACTOR_POWER_RANGE');
  const power=base**BigInt(exponent);checkpoint();
  if(quotient%power!==0n)fail('ARITHMETIC_IDENTITY');
  quotient/=power;multiplicity+=exponent;previous=base;
  factors.push(Object.freeze({value,exponent}));
 }
 checkpoint();if(quotient!==remaining)fail('ARITHMETIC_IDENTITY');
 return inspection(input,n,remainingText,remaining,factors,multiplicity);
}
