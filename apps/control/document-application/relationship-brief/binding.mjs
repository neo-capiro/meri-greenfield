/** Preparation correspondence; canonical current-session/artifact owners retain authority. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {admitPreparedRelationshipBrief} from './compose.mjs';
export function bindPreparedRelationshipArtifactOptions(prepared,artifactOptions){
 if(!artifactOptions||typeof artifactOptions!=='object'||types.isProxy(artifactOptions))throw Error('RELATIONSHIP_CONFIGURATION');
 const fields=Reflect.ownKeys(artifactOptions),options=own(artifactOptions,['context','authority'],fields.filter(k=>!['context','authority'].includes(k)));
 const guard=admitPreparedRelationshipBrief(prepared,options.context),authority=options.authority,hash=v.hash(options.context);
 if(!authority||typeof authority!=='object'||types.isProxy(authority))throw Error('RELATIONSHIP_CONFIGURATION');
 const method=Object.getOwnPropertyDescriptor(authority,'check');if(!method||!Object.hasOwn(method,'value')||typeof method.value!=='function')throw Error('RELATIONSHIP_CONFIGURATION');
 return {...options,authority:{async check(call){try{const intent=own(v.snapshot(call.input),['request','context','baseVersionId']);guard(intent);if(v.hash(intent.context)!==hash)throw Error();}catch{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}return method.value.call(authority,call);}}};
}
