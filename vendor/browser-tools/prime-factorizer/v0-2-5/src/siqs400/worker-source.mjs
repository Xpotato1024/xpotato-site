// SPDX-License-Identifier: AGPL-3.0-only
// Fixed local wrapper transformation. Original WASM and role/budget protocol are retained.
import {selectedWideWorkerSource} from '../selected-wide/worker-source.mjs';
import {validateInput} from '../rusqsieve/contracts.mjs';
import {validateDlpConfiguration} from '../rusqsieve-dlp/contracts.mjs';
import {validateSiqs400Input,validateSiqs400Configuration} from './contracts.mjs';
const once=(source,oldText,newText)=>{
 if(source.split(oldText).length!==2)throw Error('SIQS400 source anchor');
 return source.replace(oldText,newText);
};
const originalInput=validateInput.toString();
const input400=validateSiqs400Input.toString().replace('validateSiqs400Input','validateInput');
const originalConfig=validateDlpConfiguration.toString();
// Preserve existing validator and append strict high-tier validation.
const config400=validateSiqs400Configuration.toString().replace('validateSiqs400Configuration','validateDlpConfiguration400');
const sources=new Map();
export function siqs400WorkerSource(cap){
 if(sources.has(cap))return sources.get(cap);
 let source=selectedWideWorkerSource(cap);
 source=once(source,originalInput,input400);
 source=once(source,originalConfig,originalConfig+'\n'+config400);
 source=once(source,'validateDlpConfiguration(c,profile,BigInt(input).toString(2).length);','validateDlpConfiguration400(c,profile,BigInt(input).toString(2).length);');
 sources.set(cap,source);return source;
}
