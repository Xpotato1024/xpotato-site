// SPDX-License-Identifier: AGPL-3.0-only
// Public presentation metadata and adapter policy share these unchanged bounds.
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const modes=[
 {id:'standard',label:'通常',uiLabel:'通常（小さい入力）',maxDigits:39,maxBits:128,timeBudgetMaxMs:60000},
 {id:'optimized',label:'高精度',uiLabel:'高精度（有界SIQS）',maxDigits:100,maxBits:332,timeBudgetMaxMs:600000},
 {id:'wide',label:'大メモリ',uiLabel:'大メモリ（明示設定）',maxDigits:100,maxBits:332,timeBudgetMaxMs:3600000}
];
export const SITE_CAPABILITIES=freeze({schemaVersion:1,kind:'integer-factorization',input:{maxTextLength:4096,minimum:'0',scientificNotation:true},defaultMode:'standard',completionGuaranteed:false,modes,smallInputRoute:{modeId:modes[0].id,exclusiveUpperPowerOfTwo:modes[0].maxBits,timeBudgetMaxMs:modes[0].timeBudgetMaxMs}});
export const SITE_MODES=Object.freeze(Object.fromEntries(SITE_CAPABILITIES.modes.map(mode=>[mode.id,mode])));
