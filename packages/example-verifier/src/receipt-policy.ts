import {fingerprint} from "@xpotato/content-contracts/canonical";
import {exampleSandboxProfileV1} from "./profiles.js";
const records={
 "python-stdlib-v1":{mode:"sandbox",runtime:"python",version:"3.14.7",verifier:"python-stdlib"},
 "node-self-contained-v1":{mode:"sandbox",runtime:"node",version:"24.22.1",verifier:"node-self-contained"},
 "sqlite-disposable-v1":{mode:"sandbox",runtime:"sqlite",version:"3.53.4",verifier:"sqlite-disposable"},
 "bash-parse-v1":{mode:"parser",runtime:"bash",version:"5.2",verifier:"bash-parse"},
 "powershell-parse-v1":{mode:"parser",runtime:"powershell",version:"7.6",verifier:"powershell-parse"},
 "typescript-check-v1":{mode:"compiler",runtime:"typescript",version:"5.9.3",verifier:"typescript-check"},
 "json-parse-v1":{mode:"parser",runtime:"node",version:"24.22.1",verifier:"strict-json-parse"},
 "yaml-parse-v1":{mode:"parser",runtime:"yaml",version:"2.8.3",verifier:"safe-yaml-parse"},
 "docker-compose-config-v1":{mode:"schema",runtime:"docker-compose",version:"2",verifier:"compose-config-only"},
} as const;
export function exampleReceiptPolicy(profileId:string,requestedClass?:"syntax_checked"|"sandbox_executed"){
 const record=records[profileId as keyof typeof records];if(!record)throw Error("EXAMPLE_VERIFICATION_PROFILE_UNKNOWN");
 const syntaxOnly=record.mode==="sandbox"&&requestedClass==="syntax_checked";
 const mode=syntaxOnly?"parser" as const:record.mode;
 const verifier=syntaxOnly?record.runtime+"-syntax-only":record.verifier;
 const boundary=mode==="sandbox"?exampleSandboxProfileV1:{
  id:"nonexecuting-parser-boundary-v1",network:"none",credentials:"none",targetCodeExecution:false,
  inputMaxBytes:262144,combinedOutputMaxBytes:1048576,wallTimeoutSeconds:15,
 };
 const policy={schemaVersion:1,profileId,...record,mode,verifier,boundary,
  class:mode==="sandbox"?"sandbox_executed" as const:"syntax_checked" as const};
 return {...policy,profileSha256:fingerprint(policy),boundarySha256:fingerprint(boundary)};
}
export const versionMatches=(actual:string,expected:string)=>actual===expected||expected.split(".").length<3&&actual.startsWith(expected+".");
