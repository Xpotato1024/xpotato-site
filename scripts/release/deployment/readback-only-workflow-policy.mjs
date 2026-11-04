import {createHash} from 'node:crypto';
export const readbackWorkflowPath='.github/workflows/site-readback-only.yml';
export const readbackWorkflowSha256='af7f2baa3c1b937e420e09f6ab7f1db1d75b3b4cc746d5466e44e52a8863b460';
export const readbackJobGuard="github.repository == 'Xpotato1024/xpotato-site' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && github.actor == 'Xpotato1024' && github.triggering_actor == 'Xpotato1024' && github.run_attempt == 1 && inputs.readback_approved && inputs.verifier_sha == github.sha";
export function assertReadbackWorkflow(text){
  if(typeof text!=='string'||createHash('sha256').update(text).digest('hex')!==readbackWorkflowSha256
    ||!text.includes('    if: '+readbackJobGuard+'\n')||!text.includes('    environment: site-production\n')
    ||!text.includes('  group: site-production\n  cancel-in-progress: false\n')||!text.includes('          if-no-files-found: error\n')
    ||/^\s+(push|pull_request|pull_request_target|workflow_run|repository_dispatch|schedule):/m.test(text)
    ||/id-token:|:\s*write\s*$|self-hosted|wrangler|manual-deployment-cli\.mjs/.test(text))throw Error('READBACK_WORKFLOW_BOUNDARY');
  return true;
}
