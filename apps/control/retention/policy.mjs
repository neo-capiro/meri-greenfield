/** Versioned retention policy: explicit required configuration, no defaults. A missing policy blocks physical purge and never blocks authorized suppression. */
import {own,data,fail,text,hash} from './boundary.mjs';
import {classes} from './inventory.mjs';
const positiveInteger=v=>Number.isSafeInteger(v)&&v>0;
export function parseRetentionPolicy(value){
 const {policySha256:declared,...p}=own(data(value),['policyId','version','coolingPeriodMs','classes'],['policySha256']);text(p.policyId);
 if(declared!==undefined&&declared!==hash(p))fail('RETENTION_POLICY_INVALID');
 if(!positiveInteger(p.version)||!positiveInteger(p.coolingPeriodMs))fail('RETENTION_POLICY_INVALID');
 const configured=own(p.classes,[...classes]);
 for(const name of classes){const c=own(configured[name],['retentionMs','purgeable']);if(!positiveInteger(c.retentionMs)||typeof c.purgeable!=='boolean')fail('RETENTION_POLICY_INVALID');}
 return Object.freeze({...p,policySha256:hash(p)});
}
/** Purge needs a policy; suppression does not. */
export function requirePurgePolicy(policy){if(policy===null||policy===undefined)fail('RETENTION_POLICY_REQUIRED');return parseRetentionPolicy(policy);}
/** Purge eligibility: suppressed, cooling elapsed, class purgeable, retention elapsed since the subject's last activity. */
export function purgeEligibility({policy,className,suppressedAtMs,lastActivityAtMs,nowMs}){
 const p=requirePurgePolicy(policy);if(!classes.includes(className))fail('RETENTION_INVALID_REQUEST');const c=p.classes[className],reasons=[];
 if(!Number.isSafeInteger(suppressedAtMs))reasons.push('NOT_SUPPRESSED');else if(nowMs-suppressedAtMs<p.coolingPeriodMs)reasons.push('COOLING_PERIOD');
 if(!c.purgeable)reasons.push('CLASS_NOT_PURGEABLE');if(!Number.isSafeInteger(lastActivityAtMs)||nowMs-lastActivityAtMs<c.retentionMs)reasons.push('RETENTION_PERIOD');
 return Object.freeze({eligible:reasons.length===0,reasons:Object.freeze(reasons),policyId:p.policyId,policyVersion:p.version});
}
