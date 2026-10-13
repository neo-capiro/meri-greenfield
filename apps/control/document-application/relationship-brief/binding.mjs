import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {admitPreparedRelationshipBrief} from './compose.mjs';
export function bindPreparedRelationshipArtifactOptions(prepared,options){const guard=admitPreparedRelationshipBrief(prepared,options.context),authority=options.authority,hash=v.hash(options.context);return {...options,authority:{async check(call){try{const intent=own(v.snapshot(call.input),['request','context','baseVersionId']);guard(intent);if(v.hash(intent.context)!==hash)throw Error();}catch{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}return authority.check(call);}}};}
