import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {spawnSync} from 'node:child_process';

it('isolates reusable media secrets to the trusted manual main job and keeps deploy separate',()=>{
 const source=readFileSync('.github/workflows/publish-article-media.yml','utf8'),workflow=parse(source);
 expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
 expect(workflow.permissions).toEqual({contents:'read'});
 const job=workflow.jobs.publication;
 expect(Object.keys(workflow.jobs)).toEqual(['publication']);
 expect(job.permissions).toEqual({contents:'write'});
 for(const guard of ["github.repository == 'Xpotato1024/xpotato-site'","github.event_name == 'workflow_dispatch'","github.ref == 'refs/heads/main'","github.actor == 'Xpotato1024'","github.triggering_actor == 'Xpotato1024'","github.run_attempt == 1","github.sha == inputs.source_sha"])expect(job.if).toContain(guard);
 expect(job.environment).toBe('site-production');expect(workflow.concurrency['cancel-in-progress']).toBe(false);
 const steps=job.steps,secretSteps=steps.filter((s:Record<string,unknown>)=>JSON.stringify(s).includes('secrets.'));
 expect(secretSteps).toHaveLength(1);expect(secretSteps[0].env).toMatchObject({R2_MEDIA_ACCESS_KEY_ID:'${{ secrets.R2_MEDIA_ACCESS_KEY_ID }}',R2_MEDIA_SECRET_ACCESS_KEY:'${{ secrets.R2_MEDIA_SECRET_ACCESS_KEY }}'});
 const acquisition=steps.findIndex((s:{name?:string})=>s.name?.startsWith('Acquire')),publication=steps.indexOf(secretSteps[0]);
 expect(acquisition).toBeGreaterThan(0);expect(acquisition).toBeLessThan(publication);
 expect(steps.find((s:{uses?:string})=>s.uses?.startsWith('actions/checkout@')).with).toEqual({ref:'${{ github.sha }}','persist-credentials':false});
 expect(source).not.toMatch(/pull_request_target|CLOUDFLARE_SITE_API_TOKEN|wrangler deploy|git push/u);
 for(const s of steps.filter((s:{uses?:string})=>s.uses))expect(s.uses).toMatch(/@[a-f0-9]{40}$/u);
});

it('checks the environment-only switch after job admission and before acquisition or storage',()=>{
 const job=parse(readFileSync('.github/workflows/publish-article-media.yml','utf8')).jobs.publication;
 expect(job.if).not.toContain('vars.');
 expect(job.env).not.toHaveProperty('MEDIA_PUBLICATION_ENABLED');
 const guard=job.steps[0];
 expect(guard.env.MEDIA_PUBLICATION_ENABLED).toBe('${{ vars.MEDIA_PUBLICATION_ENABLED }}');
 const code=/^node -e "([^"]+)"$/u.exec(guard.run)?.[1];
 expect(code).toBeTruthy();
 for(const value of [undefined,'false','true']){
  const env={...process.env};delete env.MEDIA_PUBLICATION_ENABLED;
  if(value!==undefined)env.MEDIA_PUBLICATION_ENABLED=value;
  expect(spawnSync(process.execPath,['-e',code!],{env}).status).toBe(value==='true'?0:1);
 }
 for(const step of job.steps.filter((s:{name?:string})=>s.name?.startsWith('Acquire')||s.name?.startsWith('Save')))
  expect(step.env.MEDIA_PUBLICATION_ENABLED).toBe('${{ vars.MEDIA_PUBLICATION_ENABLED }}');
});
