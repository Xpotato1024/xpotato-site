import {SELECTED_STAGED_MODE} from '../engine/staged-selected.mjs';
import {runStagedRequest} from './staged-controller.mjs';
export const runSelectedStagedRequest=(input,options={},dependencies={})=>runStagedRequest(input,{...options,mode:SELECTED_STAGED_MODE},dependencies);
