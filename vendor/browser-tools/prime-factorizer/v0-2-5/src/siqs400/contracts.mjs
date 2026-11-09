// SPDX-License-Identifier: AGPL-3.0-only
import {validateDlpConfiguration} from '../rusqsieve-dlp/contracts.mjs';
export const SIQS400_LIMITS=Object.freeze({maxBits:400,maxDigits:121,nativeStorageBits:1024});
export function validateSiqs400Input(input){
 if(typeof input!=='string'||input.length>121||!/^[1-9][0-9]*$/.test(input))throw Error('Canonical integer required');
 const n=BigInt(input),bits=n.toString(2).length;if(n<2n||bits>400)throw Error('Input outside SIQS400 profile');return{input,bits};
}
export function validateSiqs400Configuration(c,profile,bits){
 if(profile!=='baseline'||!Number.isInteger(bits)||bits<2||bits>400)throw Error('SIQS400 configuration range');
 validateDlpConfiguration(c,profile,bits);
 if(bits<334)return;
 const bound=bits<=368?3000000:6000000,double=BigInt(bound)**2n*1214n;
 const expected={factorBaseBound:bound,intervalHalfWidth:bits<=368?262144:524288,
  singleLimit:String(bound*145),doubleLimit:String(double),lpBits:double.toString(2).length,thresholdAdjustment:-23};
 for(const [key,value]of Object.entries(expected))if(c[key]!==value)throw Error('SIQS400 configuration '+key);
}
