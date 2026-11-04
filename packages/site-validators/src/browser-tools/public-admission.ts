import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {browserToolPinSchema,browserToolReviewSchema,type BrowserToolPin} from '@xpotato/content-contracts';
import {toolHash} from './browser-tool-adoption.js';

export const publicAdmissionPath='config/browser-tools/public-admissions.json';
export const publicAdmissionsSchema={parse(raw:unknown){
 const outer=z.object({schemaVersion:z.literal(1),releases:z.array(z.unknown()).max(32)}).strict().parse(raw);
 const releases=outer.releases.map(p=>browserToolPinSchema.parse(p));
 if(new Set(releases.map(p=>p.toolId)).size!==releases.length)throw Error('One exact public admission per tool');
 return {schemaVersion:1 as const,releases};
}};
/** Exact source/release review, never a blanket capability or CSP permission. */
export function assertToolPublicAdmission(pinInput:unknown,reviewInput:unknown,admissionInput:unknown,{bounded=false}={}){
 const pin=browserToolPinSchema.parse(pinInput),review=browserToolReviewSchema.parse(reviewInput),admission=browserToolPinSchema.parse(admissionInput);
 if(pin.source.kind!=='github'||JSON.stringify(pin)!==JSON.stringify(admission)
  ||(bounded&&!review.runtimeReview)||review.review.scope!=='source-and-release'||review.review.decision!=='admit'
  ||toolHash(JSON.stringify(review))!==pin.reviewSha256||JSON.stringify(review.source)!==JSON.stringify(pin.source)
  ||(['sourceCommit','sourceTreeSha256','lockSha256','manifestSha256','artifactSha256'] as const).some(key=>review[key]!==pin[key])
  ||review.reproducibleArtifactSha256.some(hash=>hash!==pin.artifactSha256))throw Error('Exact reviewed tool public admission required');
}
export async function readPublicAdmissions(root:string){return publicAdmissionsSchema.parse(JSON.parse(await readFile(join(root,publicAdmissionPath),'utf8')));}
export async function admitsPublicTool(pin:BrowserToolPin,root=fileURLToPath(new URL('../../../../',import.meta.url)),bounded=false){
 const admission=(await readPublicAdmissions(root)).releases.find(p=>p.toolId===pin.toolId&&p.releaseId===pin.releaseId);
 if(!admission)return false;
 const review=JSON.parse(await readFile(join(root,'docs/acceptance/browser-tools',pin.toolId,pin.releaseId+'-source-review.json'),'utf8'));
 assertToolPublicAdmission(pin,review,admission,{bounded});return true;
}
