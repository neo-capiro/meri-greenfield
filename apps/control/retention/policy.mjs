/** Versioned retention policy: explicit required configuration, no defaults. A missing policy blocks physical purge and never blocks authorized suppression. */
import {own,data,fail,text,hash,uuid} from './boundary.mjs';
import {classes,externalClasses} from './inventory.mjs';
const positiveInteger=v=>Number.isSafeInteger(v)&&v>0;
export function parseRetentionPolicy(value){
 const {policySha256:declared,...p}=own(data(value),['policyId','version','coolingPeriodMs','classes'],['policySha256']);text(p.policyId);
 if(declared!==undefined&&declared!==hash(p))fail('RETENTION_POLICY_INVALID');
 if(!positiveInteger(p.version)||!positiveInteger(p.coolingPeriodMs))fail('RETENTION_POLICY_INVALID');
 const configured=own(p.classes,[...classes]);
 // A retained class (identifier-only evidence) is never purgeable by a subject purge; a policy that says otherwise is refused.
 for(const name of classes){const c=own(configured[name],['retentionMs','purgeable']);if(!positiveInteger(c.retentionMs)||typeof c.purgeable!=='boolean'||c.purgeable&&externalClasses.includes(name))fail('RETENTION_POLICY_INVALID');}
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

/** Core owns the 720-hour Trash deadline. Suppression can precede its commit, so
 * suppression age must never substitute for this exact committed generation.
 * checkedAtMs is an observation, excluded from the stable plan identity. */
export function conversationTrashEligibility({subject,journalState,trash,nowMs}){
 if(subject.kind!=='conversation')return null;
 const reason=journalState?.reason;
 if(trash===undefined&&!String(reason??'').startsWith('conversation-trash:'))return null;
 if(!trash)fail('RETENTION_TRASH_AUTHORITY_REQUIRED');
 const t=own(data(trash),['requestId','revision','trashedAtMs','restoreUntilMs','checkedAtMs']);
 uuid(t.requestId);
 if(
    typeof t.revision!=='string'||!/^([1-9][0-9]*)$/u.test(t.revision)||
    ![t.trashedAtMs,t.restoreUntilMs,t.checkedAtMs,nowMs].every(Number.isSafeInteger)||
    t.trashedAtMs<0||t.restoreUntilMs-t.trashedAtMs!==30*24*60*60*1000||
    Math.abs(nowMs-t.checkedAtMs)>5000)fail('RETENTION_TRASH_AUTHORITY_REQUIRED');
 if(reason!==`conversation-trash:${t.requestId}`)fail('RETENTION_TRASH_GENERATION_REFUSED');
 const {checkedAtMs,...identity}=t;
 return Object.freeze({identity:Object.freeze(identity),expired:checkedAtMs>=t.restoreUntilMs&&nowMs>=t.restoreUntilMs});
}
