import {isApprovedOperation} from './operator-capability.js';
import type {OneShotPublicationOperation} from './publication-operator-plan.js';
import type {ServerMediaSessionFactory} from './media-session-factory.js';
import type {Plane,ObjectRead} from './publication-contracts.js';
import {persistOneShotOperatorStage} from './publication-operator-runtime.js';
import {exportOneShotOperatorCandidate} from './publication-operator-export.js';

/** The minimal Site callback consumed by Server's existing owner operator
 * host. The Server owns the broker, policy observer, concealment and cleanup;
 * Site sees only three stage factories and the actual HTTP transport. */
export function createOneShotSiteOperatorBinding(operation:OneShotPublicationOperation,transport:{kind:'isolated-child-put-v1';fetcher:typeof fetch},
 readPublic:(key:string,maxBytes:number,signal?:AbortSignal)=>Promise<ObjectRead>){
 if(!isApprovedOperation(operation))throw Error('OPERATOR_APPROVED_EXECUTABLE_HANDLE_REQUIRED');
 if(transport?.kind!=='isolated-child-put-v1'||typeof transport.fetcher!=='function')throw Error('OPERATOR_ISOLATED_PUT_TRANSPORT_REQUIRED');
 if(typeof readPublic!=='function')throw Error('OPERATOR_PUBLIC_DELIVERY_READBACK_REQUIRED');
 return Object.freeze({validateRequest:operation.validateRequest,assertApproved:operation.assertApproved,
  preflight:operation.readContext,
  async run(session:{stages:Readonly<Record<Plane,{factory:ServerMediaSessionFactory}>>},signal?:AbortSignal){
   const bindings={factories:{source:session.stages.source.factory,public:session.stages.public.factory,protected:session.stages.protected.factory},fetcher:transport.fetcher,readPublic};
   for(const plane of ['source','public','protected'] as const)await persistOneShotOperatorStage(operation,plane,bindings,signal);
   return exportOneShotOperatorCandidate(operation,bindings,signal);
  }});
}
