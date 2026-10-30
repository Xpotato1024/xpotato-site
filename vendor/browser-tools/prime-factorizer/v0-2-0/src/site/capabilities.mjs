// SPDX-License-Identifier: AGPL-3.0-only
import {EXTENDED_INPUT_CANDIDATE as candidate} from '../core/extended-input-contract.mjs';
// Acceptance limits are separate from the staged/SIQS processing profiles.
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const modes=[
 {id:'standard',label:'通常',uiLabel:'通常（共通の有限探索）',maxDigits:candidate.maxInputDigits,maxBits:candidate.maxInputBits,timeBudgetMaxMs:60000},
 {id:'optimized',label:'高精度',uiLabel:'高精度（有界探索）',maxDigits:100,maxBits:332,timeBudgetMaxMs:600000},
 {id:'wide',label:'大メモリ',uiLabel:'大メモリ（400bit実験対応）',maxDigits:121,maxBits:400,experimentalAboveBits:332,timeBudgetMaxMs:3600000}
];
export const SITE_CAPABILITIES=freeze({schemaVersion:1,kind:'integer-factorization',input:{maxTextLength:4096,minimum:'0',scientificNotation:true},defaultMode:'standard',completionGuaranteed:false,modes,smallInputRoute:{modeId:modes[0].id,exclusiveUpperPowerOfTwo:candidate.smallRouteExclusiveBits,timeBudgetMaxMs:modes[0].timeBudgetMaxMs}});
export const SITE_MODES=Object.freeze(Object.fromEntries(SITE_CAPABILITIES.modes.map(mode=>[mode.id,mode])));
