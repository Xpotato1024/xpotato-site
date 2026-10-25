import {normalizeOptions} from './options.mjs';
export const STAGED_LIMIT=1n<<128n;
export const STAGED_MODES=Object.freeze(['brent','ecm','siqs','p64','p80']);
export function parseStagedInput(text) {
 if(typeof text!=='string'||text.length>39||!/^(0|[1-9][0-9]*)$/.test(text))throw RangeError('Staged input range');
 const value=BigInt(text);if(value>=STAGED_LIMIT)throw RangeError('Staged input range');return value;
}
export function selectStagedPlan(text,options={}) {
 const value=parseStagedInput(text);
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['mode','seed','timeBudgetMs','operationBudget'].includes(k)))throw TypeError('Staged options');
 const {mode='p64',...given}=options;if(!STAGED_MODES.includes(mode))throw RangeError('Staged mode');
 const normalized=normalizeOptions({operationBudget:50000000,...given,algorithm:'siqs'});
 const config=Object.freeze({seed:normalized.seed,timeBudgetMs:normalized.timeBudgetMs,operationBudget:normalized.operationBudget});
 const bits=value.toString(2).length,cutoffBits=mode==='p80'?80:64;
 const engineMode=mode.startsWith('p')?(bits<=cutoffBits?'brent':'staged'):mode==='siqs'&&bits<64?'brent':mode;
 return Object.freeze({input:text,mode,engineMode,cutoffBits,options:config,workers:1,
  linearMemoryBytes:engineMode==='brent'?0:engineMode==='staged'?134217728:67108864,
  deliveryGraceMs:25,initializationDeadlineMs:Math.min(5000,config.timeBudgetMs)});
}
