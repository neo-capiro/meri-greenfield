/** SYNTHETIC Core-shaped replies only (shapes from capiro-backend PR66 49f328eb).
 * No Core process, credential, signature, database or network is involved. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {requestInputHash} from '../../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {custodyFixture,NOW} from '../../../runtime/objective-source/test/custody-fixture.mjs';
export {NOW};
const clone=value=>structuredClone(value);
export function coreRepliesFixture(){
 const f=custodyFixture(),g=f.issued.objectiveGeneration,s=f.issued.objectiveStrategy;
 const admission=clone(g.sourceAdmission),sourceAdmissionSha256=g.sourceAdmissionSha256;
 // Core clips the published original expiry to the admission's effect expiry.
 const request=clone(s.request);request.originalExpiresAtMs=admission.effectExpiresAtMs;request.inputSha256=requestInputHash(request);
 const executionContext=clone(s.executionContext);
 const {factsSha256:_ignored,...receipt}=f.issued.issuance,issuance=clone(f.issued.issuance);
 const source={generationJobId:admission.generationJobId,binding:clone(f.binding)};
 const admit={schemaVersion:1,sourceAdmission:admission,sourceAdmissionSha256};
 const publication={schemaVersion:1,sourceAdmissionSha256,request,requestSha256:hash(request),executionContext};
 const accept={schemaVersion:1,sourceAdmissionSha256,sourceBinding:clone(f.binding),sourceRequestSha256:issuance.requestSha256,issuance};
 const admissionRead=(acceptedAtMs=NOW)=>({...clone(admit),acceptance:acceptedAtMs===null?{availability:'unavailable',value:null}:{availability:'available',value:{...clone(accept),acceptedAtMs}}});
 return {f,source,admission,sourceAdmissionSha256,request,executionContext,issuance,receipt,
  replies:{admit:()=>clone(admit),publication:()=>clone(publication),accept:()=>clone(accept),admissionRead},
  executionSelection:clone(s.executionSelection)};
}
