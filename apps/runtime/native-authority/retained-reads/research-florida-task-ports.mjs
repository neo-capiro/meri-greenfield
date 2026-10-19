/** Selected research/Florida composition. Existing owners retain Core authority,
 * signed delegation, source decoding, and the task's live credential lifetime. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertNativeReadConfiguration,nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {familyOperations} from '../../../gateway/general-reads/registration.mjs';
import {createCoreRetainedTaskPorts} from './task-ports.mjs';
import {createResearchEvidenceTaskPorts} from './research-evidence-task-port.mjs';

export const RESEARCH_FLORIDA_TASK_FAMILIES=Object.freeze([
 'research-portfolio','research-portfolio-evidence','florida-budget']);
const refuse=code=>{throw nativeReadFault(code);};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);

/** Factory is inert: enabling selects source composition, never installation or
 * qualification. The receiving startup owner supplies reviewed signer pins. */
export function createResearchFloridaTaskPorts(configuration={}){
 const c=own(configuration,[],['familyIds','coreOrigin','fetchImpl','now','maxRequestMs',
  'maxResponseBytes','retainedAuthority','enabled']);
 if(c.enabled!==undefined&&typeof c.enabled!=='boolean')refuse('CONFIGURATION');
 if(c.enabled!==true)return ()=>refuse('UNAVAILABLE');
 const ids=data(c.familyIds);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
  ids.some(id=>!RESEARCH_FLORIDA_TASK_FAMILIES.includes(id)))refuse('CONFIGURATION');
 if(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)||
  typeof c.now!=='function'||types.isProxy(c.now))refuse('CONFIGURATION');
 const maxRequestMs=c.maxRequestMs??15000,maxResponseBytes=c.maxResponseBytes??1048576;
 if(!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)refuse('CONFIGURATION');
 const delegatedIds=ids.filter(id=>id!=='research-portfolio-evidence');
 const authority=delegatedIds.length?own(c.retainedAuthority,['issuerId','keyId','publicKeyJwk','recipients']):null;
 const delegated=authority?createCoreRetainedTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,
  now:c.now,maxRequestMs,maxResponseBytes,...authority,enabled:true}):null;
 const evidence=ids.includes('research-portfolio-evidence')?createResearchEvidenceTaskPorts({
  coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,maxRequestMs,maxResponseBytes,enabled:true}):null;
 const required=new Map(ids.map(id=>[id,familyOperations(id)]));

 return function retainedTaskPorts(raw){
  const p=own(raw,['task','getNativeCredentialWithExpiry'],['getNativeCredential','getServiceSecret',
   'getSignedSourceCredentials','getMemoryEligibilityCredentials','getToolCredential']);
  const approved=assertNativeReadConfiguration(p.task?.approvedReads);
  if(p.task?.sourceEnabled!==true||approved.enabled!==true||
   ids.some(id=>!required.get(id).some(operation=>approved.operations.some(ref=>same(ref,operation)))))refuse('UNAVAILABLE');
  // Only the existing source owners receive callbacks they understand. Never
  // reinterpret a signed-source credential or a tool handle as a user Bearer.
  const input={task:p.task,getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry};
  const core=delegated?.(input),portfolioEvidence=evidence?.(input);
  const available={...core?.families,...portfolioEvidence?.families};
  return Object.freeze({families:Object.freeze(Object.fromEntries(ids.map(id=>[id,available[id]]))),
   ...(core?{contextPorts:core.contextPorts}:{})});
 };
}
