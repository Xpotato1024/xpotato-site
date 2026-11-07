// SPDX-License-Identifier: AGPL-3.0-only
import {SITE_CAPABILITIES,SITE_MODES} from './capabilities.mjs';
import {parseIntegerInput,IntegerInputError} from '../core/integer-input.mjs';
import {selectResourcePlan as normalPlan} from '../graph-multicore/policy.mjs';
import {selectResourcePlan as widePlan} from '../selected-wide/policy.mjs';
// Mirror the frozen parser's raw-text cap; boundary tests enforce equality without changing its pinned bytes.
const MAX_INPUT_LENGTH=SITE_CAPABILITIES.input.maxTextLength,MAX_SITE_BITS=Math.max(...SITE_CAPABILITIES.modes.map(m=>m.maxBits)),MAX_SITE_DIGITS=Math.max(...SITE_CAPABILITIES.modes.map(m=>m.maxDigits));
export function parseSiteInput(raw){
 const input=parseIntegerInput(raw).canonical;
 if(input.length>MAX_SITE_DIGITS||BigInt(input).toString(2).length>MAX_SITE_BITS)throw RangeError('Maximum '+MAX_SITE_BITS+' bits / '+MAX_SITE_DIGITS+' digits');
 return input;
}
export function validateSiteInput(raw,engine='standard'){
 const input=parseSiteInput(raw);
 const mode=SITE_MODES[engine];
 if(!mode||input.length>mode.maxDigits||BigInt(input).toString(2).length>mode.maxBits)throw new IntegerInputError('MODE_RANGE');
 return input;
}
export function siteInputLimit(engine='standard'){
 const standard=engine==='standard',mode=SITE_MODES[engine]??SITE_MODES.optimized;
 return {maxDigits:mode.maxDigits,maxTextLength:MAX_INPUT_LENGTH,
  text:standard?mode.label+'：最大'+mode.maxDigits+'桁・'+mode.maxBits+'bitまで受付':mode.label+'：最大'+mode.maxDigits+'桁・'+mode.maxBits+'bit以下'+(mode.experimentalAboveBits?'（333〜400bitは実験的・全分解未検証）':''),
  note:'分解完了を保証する桁数ではありません。'};
}
export function siteInputErrorMessage(error,engine){
 if(error?.code==='INPUT_TOO_LONG')return '入力表記は'+MAX_INPUT_LENGTH+'文字以内にしてください。入力内容は切り詰めず残しています。';
 if(error?.code==='NOT_AN_INTEGER')return '小数部が残らない整数を入力してください（例：32、3.2e1）。';
 if(error?.code==='EXPONENT_OUT_OF_RANGE')return '科学表記の指数は-10000から10000の範囲で入力してください。数値自体にもモード別の上限があります。';
 if(error?.code==='INVALID_SYNTAX'||error?.code==='INVALID_TYPE')return '0以上の整数を入力してください。半角数字または科学表記（例：3.2e1）を使えます。';
 return siteInputLimit(engine).text+'。桁数・bit数の両方を満たす必要があります。受付は完走保証ではありません。';
}
export function selectSitePlan(engine,settings={},hints={},small=false){
 if(!['standard','optimized','wide'].includes(engine))throw Error('Named engine required');
 if(small||engine==='standard')return normalPlan({timeBudgetMs:Math.min(settings.timeBudgetMs??1000,SITE_MODES.standard.timeBudgetMaxMs)},hints);
 return engine==='wide'?widePlan(settings):normalPlan(settings,hints);
}
