/** Consume the managed native watchdog execution result. A VERIFIED result must carry the shared canonical causal
 * physical evidence AND be judged against the injected current clock plus the trusted original intent; counters,
 * execution status or a caller-supplied clock alone are never proof. UNKNOWN retains exact owned custody. */
import {validateNativePhysicalEvidence} from '../../packages/contracts/native-physical-absence.mjs';
const fail=()=>{throw Object.assign(Error('NATIVE_WATCHDOG_RESULT_REFUSED'),{code:'NATIVE_WATCHDOG_RESULT_REFUSED'});};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const INSTANCE=/^i-[0-9a-f]{8,17}$/u;
export const NATIVE_WATCHDOG_RESULT_SCHEMA='meri-native-watchdog-result/1';
export function validateManagedWatchdogResult(value,{intent,nowMs}={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==NATIVE_WATCHDOG_RESULT_SCHEMA)
  fail();
 if(intent!==undefined&&(value.hostId!==intent.input?.hostId||value.generation!==intent.input?.generation||
  value.deadlineMs!==intent.cleanupCeilingMs))fail();
 if(value.cleanup==='UNKNOWN'){
  const owned=value.owned===undefined?[]:value.owned;
  if(!Array.isArray(owned)||!Number.isSafeInteger(value.deadlineMs))fail();
  for(const row of owned){
   if(!row||typeof row!=='object'||typeof row.instanceId!=='string'||!INSTANCE.test(row.instanceId))fail();
   if(!Array.isArray(row.networkInterfaceIds)||!row.networkInterfaceIds.every(id=>typeof id==='string'))fail();
  }
  return Object.freeze({status:'UNKNOWN',quarantine:true,hostId:value.hostId,generation:value.generation,
   deadlineMs:value.deadlineMs,uncertain:true,owned:Object.freeze(owned.map(row=>Object.freeze({...row,
    networkInterfaceIds:Object.freeze([...row.networkInterfaceIds])})))});
 }
 // VERIFIED is a positive physical claim: it needs the trusted original intent AND the reader's injected clock.
 // An omitted discoveryComplete is not complete discovery, and observations after the injected clock are refused
 // by the shared validator rather than being bounded by the result's own deadline.
 if(value.cleanup!=='TERMINATED_AND_CORRELATED_ABSENT'||intent===undefined||!Number.isSafeInteger(nowMs)||
  value.uncertain===true||value.discoveryComplete!==true||!UUID.test(value.hostId??'')||
  !Number.isSafeInteger(value.generation)||!Number.isSafeInteger(value.deadlineMs)||
  value.physicalEvidence===undefined)fail();
 try{validateNativePhysicalEvidence(value.physicalEvidence,{nowMs,instanceId:value.instanceId,
  deadlineMs:value.deadlineMs,accountId:intent.input?.accountId,region:intent.input?.region,
  rootVolumeId:value.rootVolumeId,networkInterfaceIds:value.networkInterfaceIds});}catch{fail();}
 return Object.freeze({status:'VERIFIED',quarantine:false,hostId:value.hostId,generation:value.generation,
  instanceId:value.instanceId,rootVolumeId:value.rootVolumeId,
  networkInterfaceIds:Object.freeze([...value.networkInterfaceIds]),deadlineMs:value.deadlineMs,
  physicalEvidence:value.physicalEvidence});
}
