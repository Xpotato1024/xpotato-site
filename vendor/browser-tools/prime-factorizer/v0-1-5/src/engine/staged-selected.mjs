import {selectStagedPlan} from './staged-plan.mjs';
export const SELECTED_STAGED_MODE='p64';
export const selectValidatedStagedPlan=(input,options={})=>selectStagedPlan(input,{...options,mode:SELECTED_STAGED_MODE});
