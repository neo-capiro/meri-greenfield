/** Offline Release preparation only; no I/O, activation or tenant-setting changes. */
import {assertPlatformCapabilityLimits} from '../../apps/worker/conversation/capabilities/policy-resolution.mjs';
import {assertNativeReadConfiguration} from '../../packages/contracts/runtime-0.2/reads.mjs';

const ids=['describe_capiro_data','query_capiro_data'];
const roles=['standard_user','user_admin','capiro_admin'];
const refuse=()=>{throw Error('RESEARCH_SQL_POLICY_PREPARATION_REFUSED');};
function append(operations){
 if(!Array.isArray(operations)||ids.some(id=>!operations.some(op=>op.id===id&&op.version==='0.3.0')))refuse();
 return [...operations,...ids.filter(id=>!operations.some(op=>op.id===id&&op.version==='0.5.0')).map(id=>({id,version:'0.5.0'}))];
}
/** Requires the reviewed v3 SQL policy. Append only v5, which carries the current
 * SQL wire plus Research/Classic sources; v4 is legacy-wire-only and is not required.
 * Release binds the returned platform/approvedReads to fresh configuration and CAS
 * evidence. This pure preparation neither reads nor widens saved tenant/role policy. */
export function prepareResearchSqlPolicy({platform,approvedReads}){
 const next=structuredClone({platform,approvedReads});
 assertPlatformCapabilityLimits(next.platform);assertNativeReadConfiguration(next.approvedReads);
 if(next.approvedReads.enabled!==true||roles.some(role=>!next.platform.roleCeilings[role]))refuse();
 for(const profile of [next.platform.maximum,next.platform.defaults,...roles.map(role=>next.platform.roleCeilings[role])]){
  if(profile.generalReads!==true||!profile.readFamilies?.includes('capiro-data-v3'))refuse();
  if(!profile.readFamilies.includes('capiro-data-v5'))profile.readFamilies.push('capiro-data-v5');
  profile.activeReadOperations=append(profile.activeReadOperations);
 }
 next.approvedReads.operations=append(next.approvedReads.operations);
 assertPlatformCapabilityLimits(next.platform);assertNativeReadConfiguration(next.approvedReads);
 return next;
}
