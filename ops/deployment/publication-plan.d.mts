export interface PublicTarget {path:string;bytes:number;sha256:string}
export interface PublicationPlan {protocol:'xpotato-publication-v1';sourceSha:string;media:unknown;routes:string[];headers:string;files:PublicTarget[];targets:PublicTarget[];budgets:{targets:number;bytes:number}}
export const publicationProtocol:'xpotato-publication-v1';
export function readPublicationFiles(dist:string):Promise<Map<string,Buffer>>;
export function compilePublicationPlan(input:{files:Map<string,Buffer>;sourceSha:string;media:unknown;headers:string;publishedRoutes?:string[]}):PublicationPlan;
export function assertPublicationPlan(dist:string,sourceSha:string):Promise<PublicationPlan>;
