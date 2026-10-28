/** Recipe correspondence only; current artifact/session owners retain authorization.
 * The bound options also own the retained-evidence admission: earlier-run evidence is admitted only
 * for this exact prepared context, so a revision keeps the immutable parent's evidence and nothing
 * else can present itself as retained. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {admitPreparedReport,preparedReportEvidenceSha256} from './compose.mjs';
export function bindPreparedReportArtifactOptions(prepared,artifactOptions){
 if(!artifactOptions||typeof artifactOptions!=='object'||types.isProxy(artifactOptions))throw Error('REPORT_CONFIGURATION');
 const fields=Reflect.ownKeys(artifactOptions),options=own(artifactOptions,['context','authorize'],fields.filter(k=>!['context','authorize'].includes(k)));
 if(typeof options.authorize!=='function'||types.isProxy(options.authorize))throw Error('REPORT_CONFIGURATION');
 const evidenceSha256=preparedReportEvidenceSha256(prepared);
 const guard=admitPreparedReport(prepared,options.context),intent={request:prepared.request,context:options.context,baseVersionId:prepared.baseVersionId};
 guard(intent);const contextSha256=v.hash(intent.context),expected=v.nativeRequestSha256(intent.request,intent.context,intent.baseVersionId);
 const admitRetainedEvidence=context=>v.hash(context)===contextSha256&&v.hash(context.evidence)===evidenceSha256?undefined:1;
 return {...options,admitRetainedEvidence,async authorize(call){
  try{own(call,['action','resource','requestSha256','binding','scopes'],['deadlineMs','signal']);v.snapshot(call.resource);guard(intent);if(v.hash(intent.context)!==contextSha256)throw Error('mutated context');}catch{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}
  if(['artifact.generate','artifact.revise'].includes(call.action)){
   if(call.action!==(intent.baseVersionId===null?'artifact.generate':'artifact.revise')||call.requestSha256!==expected||call.resource.versionId!==intent.baseVersionId||v.hash(call.binding)!==v.hash(intent.context.binding)||v.hash(call.scopes)!==v.hash(intent.context.scopes))throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
  }
  return options.authorize.call(artifactOptions,call);
 }};}
