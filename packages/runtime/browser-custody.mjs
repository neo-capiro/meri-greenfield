/** Internal browser custody shape shared by the canonical journal and native host currentness. */
import {own,data} from '../contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256} from '../contracts/validate.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const uuid=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value))fail('BROWSER_CUSTODY_REFUSED');};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export const BROWSER_CUSTODY_SCHEMA='meri-browser-custody/1';
export function assertBrowserCustody(raw,{binding,controlId}={}){
 const value=data(own(raw,['schema','binding','controlId','ownerInstanceId','hostId','generation','leaseEpoch','policySha256','expiresAtMs']));
 validateShape('RunBinding',value.binding);uuid(value.controlId);uuid(value.ownerInstanceId);uuid(value.hostId);
 if(value.schema!==BROWSER_CUSTODY_SCHEMA||binding&&!same(value.binding,binding)||controlId&&value.controlId!==controlId||
  !Number.isSafeInteger(value.generation)||value.generation<1||!Number.isSafeInteger(value.leaseEpoch)||value.leaseEpoch<1||
  !Number.isSafeInteger(value.expiresAtMs)||value.expiresAtMs<1||typeof value.policySha256!=='string'||!/^[a-f0-9]{64}$/u.test(value.policySha256))fail('BROWSER_CUSTODY_REFUSED');
 return value;
}
export function assertBrowserReturn(raw,custody){
 const value=data(own(raw,['ownerInstanceId','leaseEpoch','snapshotSha256']));
 if(value.ownerInstanceId!==custody.ownerInstanceId||value.leaseEpoch!==custody.leaseEpoch+1||
  typeof value.snapshotSha256!=='string'||!/^[a-f0-9]{64}$/u.test(value.snapshotSha256))fail('BROWSER_CUSTODY_REFUSED');
 return value;
}

/** Internal exact continuation metadata, released only by authenticated host currentness. */
export function assertBrowserHandoff(raw,{targetBinding}={}){
 const value=data(own(raw,['custody','returned','targetBinding','controlId'])),custody=assertBrowserCustody(value.custody);
 assertBrowserReturn(value.returned,custody);validateShape('RunBinding',value.targetBinding);uuid(value.controlId);
 const source=custody.binding,target=value.targetBinding;
 if(targetBinding&&!same(target,targetBinding)||value.controlId===custody.controlId||
  ['tenantId','actorId','conversationId'].some(key=>source[key]!==target[key])||target.writerFence!==source.writerFence+1||
  ['runId','attemptId','workerId'].some(key=>source[key]===target[key]))fail('BROWSER_CUSTODY_REFUSED');
 return value;
}
