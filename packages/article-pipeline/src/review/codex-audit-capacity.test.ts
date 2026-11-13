import {describe,it,expect,vi} from 'vitest';
import {canonicalJson,sha256} from '../canonical.js';
import {runExistingCodexAudit} from './codex-audit.js';
import {prepareExistingAuditInvocation} from './existing-audit-invocation.js';
import {RuntimeOperationJournal} from '../runtime-journal.js';
import {safeReadBytes} from '../private-files.js';
vi.mock('./existing-audit-invocation.js',()=>({prepareExistingAuditInvocation:vi.fn()}));
vi.mock('../runtime-journal.js',()=>({RuntimeOperationJournal:vi.fn()}));
vi.mock('../private-files.js',async importOriginal=>({
 ...await importOriginal<typeof import('../private-files.js')>(),safeReadBytes:vi.fn(()=>{throw Error('unexpected disk read');})
}));
describe('audit capacity preflight before dispatch',()=>{
 it('rejects an irreducible oversized input before journal creation, executable read, files or child process',async()=>{
  const bytes=Buffer.from(canonicalJson({source:'x'.repeat(1_048_577)}));
  vi.mocked(prepareExistingAuditInvocation).mockResolvedValue({
   profile:{provider:'openai',model:'gpt-6.1-sol',freshContext:true,timeoutMs:25_000},
   request:{stage:'content_audit'},manifest:{},
   artifacts:[{artifactId:'audit-source',sha256:sha256(bytes),bytes}]
  } as any);
  await expect(runExistingCodexAudit({} as any,{executable:'not-used',executableSha256:'a'.repeat(64),nativeNode:'not-used',
   model:'gpt-6.1-sol',transport:'existing-chatgpt-codex-cli-v1'})).rejects.toThrow('CODEX_AUDIT_PROMPT_TOO_LARGE');
  expect(RuntimeOperationJournal).not.toHaveBeenCalled();
  expect(safeReadBytes).not.toHaveBeenCalled();
 });
});
