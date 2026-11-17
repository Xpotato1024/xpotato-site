import {contentIdSchema} from '@xpotato/content-contracts/common';
import {assertEditablePath} from './draft.js';
export interface EditorReviewContext {schemaVersion:1;contentId:string;commit:string;sourcePath:string;sourceSha256:string;scope:'public-git-draft';productionEligible:false}
export function validateReviewContext(value:EditorReviewContext):EditorReviewContext {
 if(value.schemaVersion!==1||value.scope!=='public-git-draft'||value.productionEligible!==false||!/^[a-f0-9]{40}$/u.test(value.commit)||!/^[a-f0-9]{64}$/u.test(value.sourceSha256))throw Error('EDITOR_REVIEW_CONTEXT_INVALID');contentIdSchema.parse(value.contentId);assertEditablePath(value.sourcePath);return value;
}
export interface EditorReviewBundle {schemaVersion:1;protocol:'editor-astro-review-v1';context:EditorReviewContext;html:string;htmlSha256:string;assetIds:string[];builtAt:string;runtime:'static-display-only';containsPrivateMedia:false;codeClean:boolean}
export const reviewArtifactName=(commit:string,contentId:string)=>{contentIdSchema.parse(contentId);if(!/^[a-f0-9]{40}$/u.test(commit))throw Error('COMMIT_INVALID');return 'editor-layout-'+commit+'-'+contentId;};
export function validateReviewBundle(value:EditorReviewBundle,expected:{commit:string;contentId:string;sourceSha256:string}):EditorReviewBundle {
 if(!value||value.schemaVersion!==1||value.protocol!=='editor-astro-review-v1'||value.runtime!=='static-display-only'||value.containsPrivateMedia!==false||value.codeClean!==true||typeof value.html!=='string'||value.html.length>24*1024*1024||!/^[a-f0-9]{64}$/u.test(value.htmlSha256)||!Array.isArray(value.assetIds)||value.assetIds.length>200||value.assetIds.some(id=>typeof id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)))throw Error('EDITOR_REVIEW_PACKAGE_INVALID');
 const context=validateReviewContext(value.context);
 if(context.commit!==expected.commit||context.contentId!==expected.contentId||context.sourceSha256!==expected.sourceSha256)throw Error('EDITOR_REVIEW_STALE');return value;
}
