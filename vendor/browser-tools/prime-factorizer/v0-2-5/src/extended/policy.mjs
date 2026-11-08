// SPDX-License-Identifier: AGPL-3.0-only
// Shared finite policy; no engine or Worker imports.
export const EXTENDED_RUNNER_LIMITS=Object.freeze({
 defaultTimeMs:1000,maxTimeMs:5000,defaultOperations:50000,maxOperations:1000000,
 workers:1,wasmBytes:0
});
