/** Offline successor preparation; no I/O, deployment or tenant policy edits. */
import {assertPlatformCapabilityLimits} from '../../apps/worker/conversation/capabilities/policy-resolution.mjs';
import {assertNativeReadConfiguration} from '../../packages/contracts/runtime-0.2/reads.mjs';

const ids=['describe_capiro_data','query_capiro_data'];
const roles=['standard_user','user_admin','capiro_admin'];
const refuse=()=>{throw Error('PRIVATE_MEETING_SQL_POLICY_REFUSED');};
function append(operations){
 if(!Array.isArray(operations)||ids.some(id=>!operations.some(op=>op.id===id&&op.version==='0.3.0')))refuse();
 return [...operations,...ids.filter(id=>!operations.some(op=>op.id===id&&op.version==='0.4.0')).map(id=>({id,version:'0.4.0'}))];
}
/** Requires the already reviewed 0.3 policy. Returns next capabilityPlatform and
 * agentcore.approvedReads material; current tenant/role denials still intersect. */
export function preparePrivateMeetingSqlPolicy({platform,approvedReads}){
 const next=structuredClone({platform,approvedReads});
 assertPlatformCapabilityLimits(next.platform);assertNativeReadConfiguration(next.approvedReads);
 if(next.approvedReads.enabled!==true||roles.some(role=>!next.platform.roleCeilings[role]))refuse();
 for(const profile of [next.platform.maximum,next.platform.defaults,...roles.map(role=>next.platform.roleCeilings[role])]){
  if(profile.generalReads!==true||!profile.readFamilies?.includes('capiro-data-v3'))refuse();
  if(!profile.readFamilies.includes('capiro-data-v4'))profile.readFamilies.push('capiro-data-v4');
  profile.activeReadOperations=append(profile.activeReadOperations);
 }
 next.approvedReads.operations=append(next.approvedReads.operations);
 assertPlatformCapabilityLimits(next.platform);assertNativeReadConfiguration(next.approvedReads);
 return next;
}
