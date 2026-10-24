/** One ordinary Core client per saved Objective job. This owner is constructed only in control. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createCoreObjectiveGenerationTransport} from '../../control/objective-generation/core-http.mjs';
import {createCoreObjectiveGenerationClient} from '../../control/objective-generation/core-client.mjs';
import {assertObjectiveRunStartRecord} from '../objective-source/run-starts.mjs';

const refuse=()=>{throw Error('OBJECTIVE_CURRENT_UNAVAILABLE');};
export function createObjectiveCorePorts({origin,getServiceSecret,runStarts,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs=3000}){
 if(typeof getServiceSecret!=='function'||typeof runStarts?.read!=='function')refuse();
 const clientFor=source=>createCoreObjectiveGenerationClient({source,now,maxRequestMs,transport:createCoreObjectiveGenerationTransport({source,origin,getServiceSecret,fetchImpl,now,maxRequestMs})});
 async function currentRecord({record,signal}){
  const saved=assertObjectiveRunStartRecord(record),a=saved.selection.sourceAdmission;
  const current=await clientFor({generationJobId:saved.generationJobId,binding:saved.binding}).current({signal});
  if(current.clientId!==a.canonical.clientId||current.consentId!==a.consentId||current.controlVersion!==a.controlVersion||
   current.effectExpiresAtMs<saved.effectExpiresAtMs||saved.effectExpiresAtMs<=now())refuse();return current;
 }
 async function forBinding({binding,signal}){
  const saved=data(await runStarts.read({binding,signal}));own(saved,['state'],['record']);
  if(saved.state==='ABSENT'){if(Object.hasOwn(saved,'record'))refuse();return null;}
  if(saved.state!=='STARTED'||hash(saved.record.binding)!==hash(binding))refuse();
  return {record:saved.record,current:await currentRecord({record:saved.record,signal})};
 }
 function acceptance(record,value){
  if(!value||hash(value.sourceBinding)!==hash(record.binding)||value.sourceAdmissionSha256!==record.sourceAdmissionSha256||
   value.sourceRequestSha256!==record.sourceRequestSha256||value.effectExpiresAtMs!==record.effectExpiresAtMs)refuse();return value;
 }
 async function accept({record,signal}){
  const r=assertObjectiveRunStartRecord(record),client=clientFor({generationJobId:r.generationJobId,binding:r.binding});
  return acceptance(r,await client.accept({admission:r.selection.sourceAdmission,record:r,signal}));
 }
 async function readAcceptance({record,signal}){
  const r=assertObjectiveRunStartRecord(record),reply=await clientFor({generationJobId:r.generationJobId,binding:r.binding}).readAdmission({signal});
  return acceptance(r,reply.acceptance);
 }
 return Object.freeze({clientFor,currentRecord,forBinding,accept,readAcceptance});
}
