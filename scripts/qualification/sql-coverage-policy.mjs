/** Offline Release preparation only: no I/O, deployment, credential access or tenant-setting changes. */
import {assertPlatformCapabilityLimits} from '../../apps/worker/conversation/capabilities/policy-resolution.mjs';
import {assertNativeReadConfiguration} from '../../packages/contracts/runtime-0.2/reads.mjs';

const ids=['describe_capiro_data','query_capiro_data'];
const roles=['standard_user','user_admin','capiro_admin'];
const same=(left,right)=>left.id===right.id&&left.version===right.version;
const refuse=()=>{throw Error('SQL_POLICY_PREPARATION_REFUSED');};
const appendOperations=values=>{
 if(!Array.isArray(values)||ids.some(id=>!values.some(row=>same(row,{id,version:'0.2.0'}))))refuse();
 return [...values,...ids.map(id=>({id,version:'0.3.0'})).filter(row=>!values.some(value=>same(value,row)))];
};

/** Bind output to capabilityPlatform and agentcore.approvedReads in the next reviewed source material.
 * Requires the retained SQL operations and generalReads=true already present; never switches a denial on. */
export function prepareSqlCoveragePolicy({platform,approvedReads}){
 const next=structuredClone({platform,approvedReads});
 // The retained material names SQL operations but omits their families. Validate the
 // completed candidate below: validating that known inconsistent input would prevent
 // this bounded offline repair. No other policy field is normalized or corrected.
 assertNativeReadConfiguration(next.approvedReads);
 if(next.approvedReads?.enabled!==true||roles.some(role=>!next.platform?.roleCeilings?.[role]))refuse();
 for(const profile of [next.platform.maximum,next.platform.defaults,...roles.map(role=>next.platform.roleCeilings[role])]){
  if(profile.generalReads!==true||!Array.isArray(profile.readFamilies))refuse();
  profile.readFamilies=[...profile.readFamilies,...['capiro-data','capiro-data-v3'].filter(name=>!profile.readFamilies.includes(name))];
  profile.activeReadOperations=appendOperations(profile.activeReadOperations);
 }
 next.approvedReads.operations=appendOperations(next.approvedReads.operations);
 assertPlatformCapabilityLimits(next.platform);assertNativeReadConfiguration(next.approvedReads);
 return next;
}
