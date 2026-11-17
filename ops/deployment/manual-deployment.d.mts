import type {PublicTarget} from './publication-plan.mjs';
export function readPublicArtifactTargets(staging:string,sourceSha:string,heldIds:string[]):Promise<{configPath:string;dist:string;targets:PublicTarget[];headers?:string;fileCount:number;heldCount:number;rasterCount:number}>;
