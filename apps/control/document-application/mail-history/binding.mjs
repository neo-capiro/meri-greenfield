/** Recipe correspondence only; current artifact/session owners retain authorization. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {admitPreparedMailHistory} from './compose.mjs';
export function bindPreparedMailHistoryArtifactOptions(prepared,artifactOptions){
 if(!artifactOptions||typeof artifactOptions!=='object'||types.isProxy(artifactOptions))throw Error('MAIL_HISTORY_CONFIGURATION');
 const fields=Reflect.ownKeys(artifactOptions),options=own(artifactOptions,['context','authorize'],fields.filter(k=>!['context','authorize'].includes(k)));
 if(typeof options.authorize!=='function'||types.isProxy(options.authorize))throw Error('MAIL_HISTORY_CONFIGURATION');
 const guard=admitPreparedMailHistory(prepared,options.context),intent={request:prepared.request,context:options.context,baseVersionId:prepared.baseVersionId};
 guard(intent);const contextSha256=v.hash(intent.context),expected=v.nativeRequestSha256(intent.request,intent.context,intent.baseVersionId);
 return {...options,async authorize(call){
  try{own(call,['action','resource','requestSha256','binding','scopes'],['deadlineMs','signal']);v.snapshot(call.resource);guard(intent);if(v.hash(intent.context)!==contextSha256)throw Error('mutated context');}catch{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}
  if(['artifact.generate','artifact.revise'].includes(call.action)){
   if(call.action!==(intent.baseVersionId===null?'artifact.generate':'artifact.revise')||call.requestSha256!==expected||call.resource.versionId!==intent.baseVersionId||v.hash(call.binding)!==v.hash(intent.context.binding)||v.hash(call.scopes)!==v.hash(intent.context.scopes))throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
  }
  return options.authorize.call(artifactOptions,call);
 }};
}
