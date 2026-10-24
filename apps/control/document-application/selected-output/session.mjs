/** Current approved output application shared by delivery and immutable artifact reads. */
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createDocumentApplication} from '../index.mjs';
import {method} from '../current.mjs';
import {hash,fail} from './preparation.mjs';
import {projectOutput,selectedInvocationId} from './projection.mjs';
import {approvedReceipt,checkOutputConfiguration,sourceAccessReceipt} from './receipts.mjs';
export async function openOutputSession(c,source,signal){
 const life=createOperationLifetime({deadlineMs:c.now()+(c.maxRequestMs??60000),now:c.now,signal,errorFactory:code=>Object.assign(Error(code),{code})});let receipt,options,projection,sessionCredential;
 const current=async()=>{const started=c.now(),raw=await life.run(signal=>c.approvedOutput.read({sourcePins:source.sourcePins,signal}));if(raw===null)return null;own(raw,['receipt','documentOptions','sessionCredential']);if(typeof raw.sessionCredential!=='string'||!raw.sessionCredential||raw.sessionCredential.length>4096)fail('SELECTED_OUTPUT_SESSION');
  const next=approvedReceipt(raw.receipt,{source,started,now:c.now,life,previous:receipt}),configured=checkOutputConfiguration(raw.documentOptions,next,source);receipt??=next;options??=configured;sessionCredential??=raw.sessionCredential;if(sessionCredential!==raw.sessionCredential)fail('SELECTED_OUTPUT_SESSION_CHANGED');return next;};
 const access=async phase=>{const started=c.now();return sourceAccessReceipt(await life.run(signal=>c.sourceAccess.check({phase,sourcePins:source.sourcePins,outputBinding:receipt.outputBinding,evidence:data(source.context.evidence),...(projection?{lineageSha256:projection.lineageSha256}:{}),signal})),{source,outputBinding:receipt.outputBinding,started,now:c.now,life});};
 const fresh=async phase=>{if(await current()===null)fail('SELECTED_OUTPUT_APPROVAL_REVOKED');await access(phase);life.check();if(hash(source.prepared)!==source.sourcePins.preparationSha256)fail('SELECTED_OUTPUT_SOURCE_CHANGED');};
 try{if(await current()===null){life.close();return null;}await access('approval');projection=projectOutput(source,receipt);const authorize=options.artifactOptions.authorize,requestSha256=hashNative(projection,source);
  const artifactOptions={...options.artifactOptions,context:projection.context,selectedInvocationId:selectedInvocationId(source,receipt.approvalDecision),
   admitRetainedEvidence(context){life.check();if(hash(source.prepared)!==source.sourcePins.preparationSha256||hash(context.evidence)!==hash(source.context.evidence)||context.evidence.some(e=>hash(e.binding)!==hash(source.context.binding)))fail('ACCESS_DENIED');projection.guard({request:projection.request,context,baseVersionId:source.sourcePins.baseVersionId});},
   async authorize(call){if(['artifact.generate','artifact.revise'].includes(call.action)&&(call.requestSha256!==requestSha256||call.resource.versionId!==source.sourcePins.baseVersionId))fail('ACCESS_DENIED');await fresh('effect');const result=await authorize.call(options.artifactOptions,call);await fresh('effect');return result;}};
  const app=createDocumentApplication({...options,artifactOptions});
  const send=async(route,body)=>{await fresh('effect');return life.run(signal=>app.handle(new Request('https://meri.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+sessionCredential,'content-type':'application/json'},body:JSON.stringify(body),signal})));};
  const readRetained=method(options.artifactOptions.versions,'read');
  const readVersion=async versionId=>{await fresh('effect');const record=data(await life.run(signal=>readRetained(versionId,signal)));await fresh('release');return record;};
  return {life,receipt,projection,send,fresh,readVersion,close:life.close};
 }catch(error){life.close();throw error;}
}

function hashNative(projection,source){projection.guard({request:projection.request,context:projection.context,baseVersionId:source.sourcePins.baseVersionId});return v.nativeRequestSha256(projection.request,projection.context,source.sourcePins.baseVersionId);}
