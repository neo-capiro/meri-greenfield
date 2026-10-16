/** Concrete Core canonical producer HTTP client. Only the actual Core source owner can attest its original job/run/consent pairing. */
import {own,data,continuationWork,coreDigest,fail} from './contract.mjs';
import {createCorePlannerTransport} from './core-http.mjs';
export function producerAdmissionRequest(value){const v=own(value,['work','phase']);if(!['start','prepare','read','stop'].includes(v.phase))fail('CONFIGURATION');return data({schemaVersion:1,phase:v.phase,work:continuationWork(v.work)});}
export function createCoreGenerationProducerClient(configuration){
 const transport=createCorePlannerTransport(configuration);
 async function admit(value){const v=own(value,['work','phase','deadlineMs'],['signal']),request=producerAdmissionRequest({work:v.work,phase:v.phase});
  try{const response=await transport.request('producer',{work:request.work,producerPhase:request.phase,deadlineMs:v.deadlineMs,...(v.signal===undefined?{}:{signal:v.signal})});if(response.kind!=='response')fail('PRODUCER_UNAVAILABLE');
   const p=data(own(response.value,['workSha256','sourceBinding','sourceRequestSha256','generationStatus','objectiveReceipt','checkedAtMs','expiresAtMs']));if(p.workSha256!==coreDigest(request.work))fail('PRODUCER_UNAVAILABLE');return p;
  }catch{fail('PRODUCER_UNAVAILABLE');}}
 return Object.freeze({available:transport.available,admit});
}
