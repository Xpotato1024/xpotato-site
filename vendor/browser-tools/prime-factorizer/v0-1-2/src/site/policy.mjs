// SPDX-License-Identifier: AGPL-3.0-only
import {parseIntegerInput} from '../core/integer-input.mjs';
import {selectResourcePlan as normalPlan} from '../graph-multicore/policy.mjs';
import {selectResourcePlan as widePlan} from '../selected-wide/policy.mjs';
export function parseSiteInput(raw){
 const input=parseIntegerInput(raw).canonical;
 if(input.length>100||BigInt(input).toString(2).length>332)throw RangeError('Maximum 332 bits / 100 digits');
 return input;
}
export function selectSitePlan(engine,settings={},hints={},small=false){
 if(!['standard','optimized','wide'].includes(engine))throw Error('Named engine required');
 if(small||engine==='standard')return normalPlan({timeBudgetMs:Math.min(settings.timeBudgetMs??1000,60000)},hints);
 return engine==='wide'?widePlan(settings):normalPlan(settings,hints);
}
