/** Canonical inert storage facts and owned deadlines; no scope authorization. */
import {createHash} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
export {v,own,data,nativeSignal,validateShape};
export const fail=code=>{throw Object.assign(Error(code),{code});};
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const same=(a,b)=>v.hash(a)===v.hash(b);
export function uuid(id){if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(id))fail('ARTIFACT_STORAGE_INPUT');return id;}
export function digest(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))fail('ARTIFACT_STORAGE_INPUT');return value;}
export function scopeFacts(raw){const scopes=data(raw);if(!Array.isArray(scopes)||!scopes.length||scopes.length>4096)fail('ARTIFACT_STORAGE_INPUT');
 scopes.forEach(scope=>validateShape('Scope',scope));if(new Set(scopes.map(v.hash)).size!==scopes.length||scopes.some(s=>s.tenantId!==scopes[0].tenantId))fail('ARTIFACT_STORAGE_INPUT');return scopes;}
export function storageLifetime({now,maxRequestMs},signal){nativeSignal(signal);return createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:code=>Object.assign(Error('ARTIFACT_STORAGE_'+code),{code:'ARTIFACT_STORAGE_'+code})});}
export function configuration(now,maxRequestMs){if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('ARTIFACT_STORAGE_CONFIGURATION');}
