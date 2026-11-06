// SPDX-License-Identifier: AGPL-3.0-only
// Local evaluation entry; not adopted by site/index.js or the release adapter.
import {createRusqsieveRunner} from '../selected-wide/runner.mjs';
import {validateSiqs400Input,validateSiqs400Configuration} from './contracts.mjs';
import {siqs400WorkerSource} from './worker-source.mjs';
export {selectResourcePlan,validateResourcePlan} from '../selected-wide/policy.mjs';
export const runSiqs400=createRusqsieveRunner({inputValidator:validateSiqs400Input,
 sourceForCap:siqs400WorkerSource,configurationValidator:validateSiqs400Configuration});
