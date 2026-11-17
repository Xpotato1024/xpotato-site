import {createHash} from 'node:crypto';

// Observed GET https://xpotato.net/robots.txt at 2026-11-04T08:36:17Z.
// Full response: 2746 bytes, sha256 e07c5a6227eb2ffc1ab7eb292edb475334a70596a311302ab56406151b94a677.
// Cloudflare documents prepending to an existing 200 response:
// https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
// The fixture preserves the observed bytes, not the different documentation example.
const prefixBytes=2676,prefixSha256='3073d1e371afb3271c7666148766fedc5145f7d8440f7114062db79b7bd58add';
const originBytes=70,originSha256='cc7aa07ebda6b8ac79827a8b110a8941101ed035f58b2b26b677974683b7f9bb';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function matchManagedRobots(target,body) {
  // A fixed prefix is not compatible with arbitrary origin directives: Allow:/
  // and named-agent groups can override future origin restrictions. Admit only
  // the reviewed wildcard Allow:/ + sitemap origin, with its exact LF bytes.
  if(target.path!=='/robots.txt'||target.bytes!==originBytes||target.sha256!==originSha256
    ||body.length!==prefixBytes+originBytes)return null;
  const prefix=body.subarray(0,prefixBytes),origin=body.subarray(prefixBytes);
  if(hash(prefix)!==prefixSha256||hash(origin)!==originSha256)return null;
  return {policy:'cloudflare-managed-robots-20261104',prefix:{bytes:prefixBytes,sha256:prefixSha256},origin:{bytes:originBytes,sha256:originSha256}};
}
