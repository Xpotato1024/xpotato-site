import type {Server,IncomingMessage,ServerResponse} from "node:http";
export function editorStaticServer(root:string,api?:(request:IncomingMessage,response:ServerResponse)=>Promise<void>):Promise<{server:Server;origin:string;close:()=>Promise<void>}>;
