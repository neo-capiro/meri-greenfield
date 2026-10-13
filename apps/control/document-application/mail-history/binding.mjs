/** Recipe correspondence only; the existing artifact/current-session owners retain authority. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {types} from 'node:util';
import {admitPreparedMailHistory} from './compose.mjs';
export function bindPreparedMailHistoryArtifactOptions(prepared,artifactOptions){
 if(!artifactOptions||typeof artifactOptions!=='object'||types.isProxy(artifactOptions))throw Error('MAIL_HISTORY_CONFIGURATION');
 const fields=Reflect.ownKeys(artifactOptions),options=own(artifactOptions,['context','authority'],fields.filter(k=>!['context','authority'].includes(k)));
 const guard=admitPreparedMailHistory(prepared,options.context),contextSha256=v.hash(options.context),authority=options.authority;
 if(!authority||typeof authority!=='object'||types.isProxy(authority))throw Error('MAIL_HISTORY_CONFIGURATION');
 const method=Object.getOwnPropertyDescriptor(authority,'check');if(!method||!Object.hasOwn(method,'value')||typeof method.value!=='function')throw Error('MAIL_HISTORY_CONFIGURATION');
 return {...options,authority:{async check(call){try{const intent=v.snapshot(call.input);own(intent,['request','context','baseVersionId']);guard(intent);if(v.hash(intent.context)!==contextSha256)throw Error('MAIL_HISTORY_REQUEST_SUBSTITUTION');}catch{throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}return method.value.call(authority,call);}}};
}
