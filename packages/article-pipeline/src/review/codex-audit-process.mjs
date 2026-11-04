// Native transport bridge: no shell, resume, login, API-key lookup or arbitrary
// model tools. The parent compiles/adopts every input byte before this starts.
import {readFile,writeFile,mkdir,mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {controlAuditChild} from './codex-audit-child.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
let temporaryRoot;const temporaryFiles=[];
const deny=b=>/authorization["']?\s*:|(?:^|\r?\n|[,{])\s*["']?(?:cookie|set-cookie)["']?\s*:|(?:api[_-]?(?:token|key)|password|session[_-]?(?:cookie|token)|mfa[_-]?code|recovery[_-]?code)["']?\s*[:=]|\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:X-Amz-Signature|X-Goog-Signature|CloudFront-Signature|[?&](?:signature|sig|token))=/iu.test(b.toString());
try{
 const file=process.argv[2];if(!file||process.argv.length!==3)throw Error('INPUT');
 const input=JSON.parse(await readFile(file,'utf8'));
 if(input.protocol!=='xpotato-codex-audit-process-v1'||input.model!=='gpt-6.1-sol'||input.maxBytes>4*1024*1024||input.timeoutMs>240000
  ||input.timeoutMs<1||!input.executable.toLowerCase().endsWith('codex.exe')||sha(await readFile(input.executable))!==input.executableSha256)throw Error('PROFILE');
 const cwd=await mkdtemp(join(tmpdir(),'xpotato-audit-'));
 temporaryRoot=cwd;
 const schema=join(cwd,'response.schema.json');await writeFile(schema,input.schema,{flag:'wx',mode:0o600});
 temporaryFiles.push(schema);
 if(deny(Buffer.from(input.prompt))||input.images.some(i=>!/^image\/(?:png|jpeg|webp)$/u.test(i.mimeType)))throw Error('PAYLOAD');
 const images=[];for(let n=0;n<input.images.length;n++){
  const image=input.images[n],bytes=Buffer.from(image.base64,'base64');if(sha(bytes)!==image.sha256)throw Error('IMAGE');
  const p=join(cwd,'image-'+n+'.'+image.mimeType.split('/')[1]);await writeFile(p,bytes,{flag:'wx',mode:0o600});images.push(p);
  temporaryFiles.push(p);
 }
 const args=['--no-daemon','-a','never','exec','--ephemeral','--ignore-user-config','--strict-config','--skip-git-repo-check','--sandbox','read-only','--cd',cwd,
  '--model',input.model,'--color','never','--json','--output-schema',schema,
  '-c','forced_login_method="chatgpt"','-c','project_doc_max_bytes=0','-c','web_search="disabled"',
  '-c','model_reasoning_effort="high"','-c','features.shell_tool=false','-c','features.apps=false',
  '-c','features.multi_agent=false','-c','features.js_repl=false'];
 // Keep managed approval/rules/hooks intact. Disable optional context import
 // and capabilities; no history, browser, plugins or memory enter the audit.
 for(const flag of ['memories','plugins','remote_plugin','browser_use','browser_use_external','computer_use','image_generation','in_app_browser',
  'multi_agent_v2','code_mode_host','unified_exec','unified_exec_tty','shell_snapshot','skill_search','skill_mcp_dependency_install','sleep_tool','view_image','tool_suggest'])args.push('-c','features.'+flag+'=false');
 args.push('-c','features.skip_host_skill_discovery=true');
 for(const image of images)args.push('--image',image);args.push('-');
 const allowedEnv=new Set(['SYSTEMROOT','WINDIR','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH','PATHEXT','COMSPEC','OS','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','CODEX_HOME']);
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>allowedEnv.has(key.toUpperCase())));
 const startedAt=new Date().toISOString();let chunks=[],errors=[],size=0;
 if(existsSync(input.cancelPath))throw Error('CANCELLED_BEFORE_START');
 const child=spawn(input.executable,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 // Direct native executable, --no-daemon and no model tools: retain its owned
 // process handle, never terminate the bridge before the CLI is closed.
 const control=controlAuditChild(child,{timeoutMs:input.timeoutMs,cancelled:()=>existsSync(input.cancelPath)});
 child.stdout.on('data',b=>{size+=b.length;if(size>input.maxBytes)control.stop();else chunks.push(b);});
 child.stderr.on('data',b=>{size+=b.length;if(size>input.maxBytes)control.stop();else errors.push(b);});
 child.stdin.on('error',()=>{});child.stdin.end(input.prompt);
 const {exitCode,stopped,containmentFailed}=await control.result;
 const stdout=Buffer.concat(chunks),stderr=Buffer.concat(errors);
 if(deny(stdout)||deny(stderr))throw Error('SECRET_RESPONSE');
 await mkdir(input.output,{recursive:true,mode:0o700});
 await writeFile(join(input.output,'stdout.jsonl'),stdout,{flag:'wx',mode:0o600});
 await writeFile(join(input.output,'stderr.txt'),stderr,{flag:'wx',mode:0o600});
 const result={protocol:input.protocol,executableSha256:input.executableSha256,model:input.model,startedAt,finishedAt:new Date().toISOString(),
  exitCode,stopped,containmentFailed,processId:child.pid,stdoutSha256:sha(stdout),stderrSha256:sha(stderr),promptSha256:sha(Buffer.from(input.prompt)),schemaSha256:sha(Buffer.from(input.schema)),
  imageSha256s:input.images.map(i=>i.sha256),toolPolicy:'no-shell-apps-web-image-tools-v1',freshContext:true};
 await writeFile(join(input.output,'process.json'),JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});
 // Remove only exact files made by this invocation, no recursive deletion.
 console.log(JSON.stringify({completed:exitCode===0&&!stopped,outputRecorded:true}));
}catch{console.error('CODEX_AUDIT_PROCESS_FAILED');process.exitCode=1;}
finally{for(const path of temporaryFiles)await unlink(path).catch(()=>{});if(temporaryRoot)await rmdir(temporaryRoot).catch(()=>{});}
