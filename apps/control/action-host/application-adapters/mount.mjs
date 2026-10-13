/** Application composition only; borrowed native/run/command owners are never disposed. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {response} from '../../action-application/http.mjs';
import {createActionHostApplication} from '../index.mjs';
import {createActionSessionOwner} from '../session/owner.mjs';
import {createActionSessionApplication,actionSessionPath} from '../session/http.mjs';
import {createApplicationContextAdapters} from './context-adapter.mjs';
export function createApplicationActionHost(configuration){
 const {services,client,currentRun,hostPorts,now,limits,sessionLimits,enabled=false}=own(configuration,['services','client','currentRun','hostPorts','now','limits','sessionLimits'],['enabled']);
 const supplied=own(services,['lookup','commandOptions','commandExecutor']),options=own(supplied.commandOptions,['operation','action','outputShape','commandContext','validators','assertProposal','approvalMetadataOwner','executor','now','limits']);
 const sessionBounds=data(own(sessionLimits,['maxSessions','maxRequestMs','maxTtlMs','maxFactBytes']));
 const ports=own(hostPorts,['reserveLookup','issueLookupCredential','issueExecution']);if(typeof enabled!=='boolean')throw Error('APPLICATION_CONFIGURATION');
 const adapters=createApplicationContextAdapters({client,currentRun,commandContext:options.commandContext,now,limits:{maxRequestMs:sessionBounds.maxRequestMs,maxFactBytes:sessionBounds.maxFactBytes}});
 const owner=createActionSessionOwner({mode:'process-local',...adapters,now,limits:sessionBounds});let app,issuance,closed=false;
 try{app=createActionHostApplication({services,...ports,authenticateSession:owner.authenticateSession,readCurrentState:owner.readCurrentState,now,limits});issuance=createActionSessionApplication({owner,now,maxRequestMs:sessionBounds.maxRequestMs});}catch(error){owner.close();throw error;}
 const mounted=Object.freeze({async handle(request){
  if(!enabled||closed)return response({error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}},503);
  let path;try{if(types.isProxy(request)||!(request instanceof Request))return issuance.handle(request);path=new URL(Object.getOwnPropertyDescriptor(Request.prototype,'url').get.call(request)).pathname;}catch{return issuance.handle(request);}
  return path===actionSessionPath?issuance.handle(request):app.handle(request);
 }});
 return Object.freeze({app:mounted,close(){closed=true;owner.close();},status:()=>({enabled,closed,sessions:owner.status().sessions})});
}
