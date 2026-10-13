/** Current approved output application shared by delivery and immutable artifact reads. */
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createDocumentApplication} from '../index.mjs';
import {hash,fail} from './preparation.mjs';
import {projectOutput} from './projection.mjs';
import {approvedReceipt,checkOutputConfiguration,sourceAccessReceipt} from './receipts.mjs';
export async function openOutputSession(c,source,signal){
 const life=createOperationLifetime({deadlineMs:c.now()+(c.maxRequestMs??60000),now:c.now,signal,errorFactory:code=>Object.assign(Error(code),{code})});let receipt,options,projection,sessionCredential;
 const current=async()=>{const started=c.now(),raw=await life.run(signal=>c.approvedOutput.read({sourcePins:source.sourcePins,signal}));if(raw===null)return null;own(raw,['receipt','documentOptions','sessionCredential']);if(typeof raw.sessionCredential!=='string'||!raw.sessionCredential||raw.sessionCredential.length>4096)fail('SELECTED_OUTPUT_SESSION');
  const next=approvedReceipt(raw.receipt,{source,started,now:c.now,life,previous:receipt}),configured=checkOutputConfiguration(raw.documentOptions,next,source);receipt??=next;options??=configured;sessionCredential??=raw.sessionCredential;if(sessionCredential!==raw.sessionCredential)fail('SELECTED_OUTPUT_SESSION_CHANGED');return next;};
 const access=async phase=>{const started=c.now();return sourceAccessReceipt(await life.run(signal=>c.sourceAccess.check({phase,sourcePins:source.sourcePins,outputBinding:receipt.outputBinding,evidence:data(source.context.evidence),...(projection?{lineageSha256:projection.lineageSha256}:{}),signal})),{source,outputBinding:receipt.outputBinding,started,now:c.now,life});};
 const fresh=async phase=>{if(await current()===null)fail('SELECTED_OUTPUT_APPROVAL_REVOKED');await access(phase);life.check();if(hash(source.prepared)!==source.sourcePins.preparationSha256)fail('SELECTED_OUTPUT_SOURCE_CHANGED');};
 try{if(await current()===null){life.close();return null;}projection=projectOutput(source,receipt,await access('approval'));const authority=options.artifactOptions.authority,authorize=options.artifactOptions.authorize;
  const app=createDocumentApplication({...options,artifactOptions:{...options.artifactOptions,context:projection.context,
   authority:{async check(call){projection.guard(call.input);await fresh('effect');const result=await authority.check.call(authority,call);await fresh('effect');return result;}},
   async authorize(call){await fresh('effect');const result=await authorize.call(options.artifactOptions,call);await fresh('effect');return result;}}});
  const send=async(route,body)=>{await fresh('effect');return life.run(signal=>app.handle(new Request('https://meri.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+sessionCredential,'content-type':'application/json'},body:JSON.stringify(body),signal})));};
  const versionPort=options.artifactOptions.versions,versionMethods=own(versionPort,['read','commit']);if(typeof versionMethods.read!=='function')fail('SELECTED_OUTPUT_READ');
  const readVersion=async versionId=>{await fresh('effect');const record=data(await life.run(signal=>versionMethods.read.call(versionPort,versionId,signal)));await fresh('release');return record;};
  return {life,receipt,projection,send,fresh,readVersion,close:life.close};
 }catch(error){life.close();throw error;}
}
