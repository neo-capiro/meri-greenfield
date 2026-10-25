/** Native filing proposals borrow the exact live action session for canonical read-only custody.
 * The existing native preparer owns metadata; this adapter creates no session, upload, filing effect or ledger. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertActionSessionReceipt,borrowedRunSession} from '../../control/action-host/session/owner.mjs';
import {createNativeAttachmentFilingPreparer} from '../../control/intents/attachment-filing-services.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {createRuntimeFilingCustody} from './filing-custody.mjs';

const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw intentFault('ACCESS_DENIED','none');};

/** Missing owners fail construction. The resolver decides whether this preparer is available before mounting it. */
export function createRuntimeAttachmentFilingPreparer(configuration){
 let c,bound,limits,selected,borrow;
 try{
  c=own(configuration,['pool','binding','scopes','selectedClientId','policyRevision','expiresAtMs','readCurrent','bound','optionsOwner','resolveVersion','now','limits']);
  bound=own(c.bound,['sessions'],['store','retention','compose']);limits=documentLimits(c.limits);
  selected=data({binding:c.binding,scopes:c.scopes,selectedClientId:c.selectedClientId});
  borrow=borrowedRunSession(bound.sessions);
  if(typeof borrow!=='function'||typeof c.resolveVersion!=='function'||types.isProxy(c.resolveVersion))throw 0;
 }catch{throw intentFault('INTENT_CONFIGURATION');}
 const maxFileBytes=Math.min(10485760,limits.maxResponseBytes);
 const custody=createRuntimeFilingCustody({sessions:bound.sessions,optionsOwner:c.optionsOwner,resolveVersion:c.resolveVersion,
  now:c.now,limits,...(bound.retention===undefined?{}:{retention:bound.retention})});
 return createNativeAttachmentFilingPreparer({pool:c.pool,...selected,policyRevision:c.policyRevision,expiresAtMs:c.expiresAtMs,
  readCurrent:c.readCurrent,now:c.now,maxRequestMs:limits.maxRequestMs,custody:{async inspectSelections(value){
   const {signal,...raw}=own(value,['objects','binding','scopes','destination','deadlineMs'],['signal']);nativeSignal(signal);
   const call=data(raw);
   if(!same(call.binding,selected.binding)||!same(call.scopes,selected.scopes)||
    !same(call.destination,{clientId:selected.selectedClientId,conversationId:selected.binding.conversationId}))deny();
   if(call.objects.some(object=>object.bytes>maxFileBytes))throw intentFault('INVALID_ARGUMENTS','none');
   const life=createOperationLifetime({deadlineMs:Math.min(call.deadlineMs,c.now()+limits.maxRequestMs),now:c.now,signal,errorFactory:code=>intentFault(code,'none')});
   let credential;
   async function currentSession(){
    const session=assertActionSessionReceipt(await life.run(signal=>borrow({binding:selected.binding,selectedClientId:selected.selectedClientId,signal})),c.now());
    const context=session.context;
    if(['tenantId','actorId','conversationId','runId'].some(key=>context[key]!==selected.binding[key])||context.selectedClientId!==selected.selectedClientId||
     credential!==undefined&&session.credential!==credential)deny();
    life.limitDeadline(session.expiresAtMs);credential??=session.credential;life.check();
   }
   try{
    await currentSession();
    for(const object of call.objects){
     const versionId=await life.run(signal=>c.resolveVersion({object,binding:selected.binding,scopes:object.scopes,deadlineMs:life.deadline(),signal}));
     await currentSession();
     await life.run(signal=>custody.recheck({object,versionId,binding:selected.binding,scopes:object.scopes,credential,deadlineMs:life.deadline(),signal}));
     await currentSession();
    }
    life.check();
   }finally{life.close();}
  }}});
}
