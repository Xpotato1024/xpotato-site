// SPDX-License-Identifier: AGPL-3.0-only
import{SELECTED_WIDE_WORKER_SOURCE as helper}from'./worker-64.mjs';
import{SELECTED_WIDE_WORKER_SOURCE as owner}from'./worker-1024.mjs';
export function selectedWideWorkerSource(cap){if(cap!==64&&cap!==1024)throw Error('Selected wide role cap');return cap===64?helper:owner;}
