import type {ChildProcess} from 'node:child_process';
export function controlAuditChild(child:ChildProcess,options:{timeoutMs:number;cancelled:()=>boolean;stopGraceMs?:number}):{
 stop:()=>void;result:Promise<{exitCode:number|null;stopped:boolean;containmentFailed:boolean}>;
};
