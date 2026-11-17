import {retentionPolicy} from './policy.js';
const day=86400000;
export interface DraftLifetime {lastEditedAt:string;reviewUntil?:string;holdUntil?:string;state:'active'|'archived'|'delete_candidate'|'deleted'|'promoted';deleteAfter?:string;publishedVerified?:boolean}
export function retentionDecision(draft:DraftLifetime,now:number):'keep'|'warn'|'archive'|'candidate'|'delete' {
 const edited=Date.parse(draft.lastEditedAt);if(!Number.isFinite(edited)||now<edited)return 'keep';
 if(draft.state==='deleted')return 'keep';
 if([draft.reviewUntil,draft.holdUntil].some(v=>v&&Date.parse(v)>now))return 'keep';
 if(draft.state==='promoted'&&!draft.publishedVerified)return 'keep';
 const age=(now-edited)/day;
 if(draft.state==='delete_candidate'&&draft.deleteAfter&&Date.parse(draft.deleteAfter)<=now&&age>=retentionPolicy.candidateDays+retentionPolicy.graceDays)return 'delete';
 if(age>=retentionPolicy.candidateDays)return 'candidate';
 if(age>=retentionPolicy.archiveDays)return 'archive';
 if(age>=retentionPolicy.warnDays)return 'warn';return 'keep';
}
export interface AssetLifetime {status:'staged'|'rejected'|'deleting'|'promoted';createdAt:string;rejectedAt?:string;holdUntil?:string;references:string[];promoting?:boolean}
export function canCollectAsset(asset:AssetLifetime,now:number):boolean {
 if(asset.references.length||asset.promoting||asset.status!=='rejected')return false;
 if(asset.holdUntil&&Date.parse(asset.holdUntil)>now)return false;
 const rejected=Date.parse(asset.rejectedAt??'');return Number.isFinite(rejected)&&now-rejected>=retentionPolicy.rejectedDays*day;
}
