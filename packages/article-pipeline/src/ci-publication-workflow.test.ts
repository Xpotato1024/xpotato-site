import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';

it('isolates reusable media secrets to the trusted manual main job and keeps deploy separate',()=>{
 const source=readFileSync('.github/workflows/publish-article-media.yml','utf8'),workflow=parse(source);
 expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
 expect(workflow.permissions).toEqual({contents:'read'});
 const job=workflow.jobs.publication;
 for(const guard of ["github.repository == 'Xpotato1024/xpotato-site'","github.event_name == 'workflow_dispatch'","github.ref == 'refs/heads/main'","github.actor == 'Xpotato1024'","github.triggering_actor == 'Xpotato1024'","github.run_attempt == 1","github.sha == inputs.source_sha","vars.MEDIA_PUBLICATION_ENABLED == 'true'"])expect(job.if).toContain(guard);
 expect(job.environment).toBe('site-production');expect(workflow.concurrency['cancel-in-progress']).toBe(false);
 const steps=job.steps,secretSteps=steps.filter((s:Record<string,unknown>)=>JSON.stringify(s).includes('secrets.'));
 expect(secretSteps).toHaveLength(1);expect(secretSteps[0].env).toMatchObject({R2_MEDIA_ACCESS_KEY_ID:'${{ secrets.R2_MEDIA_ACCESS_KEY_ID }}',R2_MEDIA_SECRET_ACCESS_KEY:'${{ secrets.R2_MEDIA_SECRET_ACCESS_KEY }}'});
 const acquisition=steps.findIndex((s:{name?:string})=>s.name?.startsWith('Acquire')),publication=steps.indexOf(secretSteps[0]);
 expect(acquisition).toBeGreaterThan(0);expect(acquisition).toBeLessThan(publication);
 expect(steps.find((s:{uses?:string})=>s.uses?.startsWith('actions/checkout@')).with).toEqual({ref:'${{ github.sha }}','persist-credentials':false});
 expect(source).not.toMatch(/pull_request_target|CLOUDFLARE_SITE_API_TOKEN|wrangler deploy|git push|contents: write/u);
 for(const s of steps.filter((s:{uses?:string})=>s.uses))expect(s.uses).toMatch(/@[a-f0-9]{40}$/u);
});
