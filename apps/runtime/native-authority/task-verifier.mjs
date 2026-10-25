/** Shared opaque capability hashing and closed operation vocabulary for native transport configuration. */
import {createHash,timingSafeEqual} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {nativeReadOperations} from '../../../packages/contracts/runtime-0.2/reads.mjs';
export const taskFault=code=>Object.assign(Error('NATIVE_TASK_'+code),{code:'NATIVE_TASK_'+code});
export const capabilityDigest=token=>createHash('sha256').update(token).digest('hex');
export function matchesCapability(token,digest){return typeof token==='string'&&/^\S{1,8192}$/u.test(token)&&timingSafeEqual(Buffer.from(capabilityDigest(token),'hex'),Buffer.from(digest,'hex'));}
const vocabulary=new Set([...Object.keys(runOwnerOperations),...sdkSessionOperations.map(op=>'runner/session/'+op),...nativeReadOperations]);
/** Inert access compiler shared by original allocation preflight and admitted verification. */
export function compileNativeTaskAccess(configuration){
 const c=own(configuration,['identityCredential','taskCapabilitySha256','operations']),operations=data(c.operations);
 if(typeof c.taskCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.taskCapabilitySha256)||typeof c.identityCredential!=='string'||!/^\S{1,8192}$/u.test(c.identityCredential)||matchesCapability(c.identityCredential,c.taskCapabilitySha256)||!Array.isArray(operations)||!operations.length||operations.length>vocabulary.size||new Set(operations).size!==operations.length||operations.some(op=>!vocabulary.has(op)))throw taskFault('CONFIGURATION');
 return operations;
}
