/** Specialize the existing trusted artifact authority, keeping the public HTTP owner exact. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {admitPreparedBrief} from './compose.mjs';
export function bindPreparedBriefArtifactOptions(prepared,artifactOptions){
  const guard=admitPreparedBrief(prepared,artifactOptions.context);
  const authority=own(artifactOptions.authority,['check'],['identify']);
  if(typeof authority.check!=='function')throw Error('BRIEF_CONFIGURATION');
  return {...artifactOptions,authority:{async check(call){
    // The canonical artifact service supplies the full typed intent at its first
    // current-authority check, before any budget reservation or byte generation.
    // This checks recipe correspondence only; existing authority owns policy.
    try{const intent=v.snapshot(call.input);own(intent,['request','context','baseVersionId']);
      guard(intent);if(v.hash(intent.context)!==v.hash(prepared.context))throw Error('BRIEF_REQUEST_SUBSTITUTION');
    }catch{throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}
    return authority.check(call);
  }}};
}
