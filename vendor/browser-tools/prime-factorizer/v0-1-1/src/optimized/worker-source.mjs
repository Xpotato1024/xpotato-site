// SPDX-License-Identifier: AGPL-3.0-only
import{OPTIMIZED_WORKER_SOURCE as s64}from'./worker-64.mjs';import{OPTIMIZED_WORKER_SOURCE as s128}from'./worker-128.mjs';import{OPTIMIZED_WORKER_SOURCE as s256}from'./worker-256.mjs';
export function optimizedWorkerSource(cap){if(![64,128,256].includes(cap))throw Error('Selected role cap');return cap===64?s64:cap===128?s128:s256;}
