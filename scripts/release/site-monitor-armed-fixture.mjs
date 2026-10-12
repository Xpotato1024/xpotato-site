import {fixture,source,T,E,at} from './site-monitor-finite-fixture.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';
export {source,T,E,at};
export function armedFixture(){
 const f=fixture();f.gate.schemaVersion=5;f.gate.status='ARMED';
 f.gate.registration={status:'OWNER_APPROVED_ARMED_REGISTRATION',registeredAt:at(-600),afterRunId:'38166551243',afterRunNumber:9,maxAdvanceSeconds:1800,maxMetadataRuns:48,maxGithubGetsPerMetadataRun:4,maxGithubGetsPerObservation:56};
 f.collector.created_at=at(-599);f.collector.updated_at=at(-599);
 const complete=(r,{noIo=false,startedAt=r.created_at}={})=>{
  const start=Date.parse(startedAt),iso=n=>new Date(start+n*1000).toISOString();r.status='completed';r.conclusion='success';r.updated_at=iso(10);
  const steps=[{name:'Armed public admission',number:1,status:'completed',conclusion:'success',started_at:iso(1),completed_at:iso(2)},{name:'Monitor armed scope '+fingerprint(f.gate),number:2,status:'completed',conclusion:'success'},{name:'Trial readonly observation',number:3,status:'completed',conclusion:noIo?'skipped':'success',...(noIo?{}:{started_at:iso(4),completed_at:iso(8)})},{name:noIo?'Monitor receipt ARMED_NO_IO '+fingerprint(f.gate):'Monitor receipt OBSERVED_MATCH',number:4,status:'completed',conclusion:'success'}];
  f.jobs[r.id]={total_count:2,jobs:[{name:'bootstrap',run_id:r.id,head_sha:r.head_sha,status:'completed',conclusion:'skipped'},{name:'observe',run_id:r.id,head_sha:r.head_sha,status:'completed',conclusion:'success',started_at:iso(0),completed_at:iso(10),steps}]};
 };
 return {...f,complete};
}
