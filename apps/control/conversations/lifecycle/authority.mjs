/** Fresh canonical authority outside SQL locks, reused before insertion and for post-commit target checks. */
import {bounded,own,same,fail,validateShape} from '../boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
export function requireTransitionAuthority(owner){if(typeof owner?.readCurrent!=='function')fail('LIFECYCLE_OWNER_UNAVAILABLE');}
export async function readTransitionAuthority({owner,expected,deadlineMs,signal,now,check}){
 requireTransitionAuthority(owner);const started=now();let life;
 try{
  life=createOperationLifetime({deadlineMs,signal,now,errorFactory:code=>Object.assign(Error(code),{code})});check();
  const current=bounded(await life.run(signal=>owner.readCurrent({...expected,deadlineMs,signal})));check();
  own(current,['binding','scopes','selectedClientId','policyRevision','checkedAtMs','expiresAtMs']);validateShape('RunBinding',current.binding);
  if(!same(current.binding,expected.binding)||!same(current.scopes,expected.scopes)||current.selectedClientId!==expected.selectedClientId||current.policyRevision!==expected.policyRevision||
   !Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<started||current.checkedAtMs>now()||!Number.isSafeInteger(current.expiresAtMs)||current.expiresAtMs<=now())fail('LIFECYCLE_TRANSITION_REFUSED');
  return current;
 }finally{life?.close();}
}
