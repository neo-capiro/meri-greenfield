/** Control-only join over already admitted task/issuance owners. Missing business owners remain unavailable. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertNativeReadConfiguration,nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {createReadTaskVerifier} from './read-task-verifier.mjs';
import {createNativeReadsOwner} from './reads-owner.mjs';
import {createNativeReadsApplication} from './reads-http.mjs';
import {types} from 'node:util';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
/** Trusted startup ports only; never part of nativeCandidate JSON. Borrowed, not disposed. */
export function captureReadRuntimeOptions(value={}){
 const c=own(value,[],['createReadsRuntime','generalReads']);
 if(c.createReadsRuntime!==undefined&&(typeof c.createReadsRuntime!=='function'||types.isProxy(c.createReadsRuntime)||types.isAsyncFunction(c.createReadsRuntime))||c.createReadsRuntime!==undefined&&c.generalReads!==undefined)throw nativeReadFault('CONFIGURATION');
 if(c.generalReads!==undefined){storageMethod(c.generalReads,'readAvailability');storageMethod(c.generalReads,'execute');}
 return Object.freeze(c);
}
export function createPreparedNativeReads(configuration){
 const c=own(configuration,['binding'],['approvedReads','allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256','scopes','currentOwner','readCurrentEntry','expiresAtMs','gateway','createReadsRuntime','taskCapability','enabled','now','signal']),now=c.now??Date.now;
 captureReadRuntimeOptions({...(c.gateway===undefined?{}:{generalReads:c.gateway}),...(c.createReadsRuntime===undefined?{}:{createReadsRuntime:c.createReadsRuntime})});
 const config=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads);
 if(c.enabled!==undefined&&typeof c.enabled!=='boolean')throw nativeReadFault('CONFIGURATION');
 const complete=config?.enabled&&c.enabled===true&&['allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256','scopes','currentOwner','readCurrentEntry','expiresAtMs'].every(k=>c[k]!==undefined)&&(c.gateway!==undefined||c.createReadsRuntime!==undefined&&typeof c.taskCapability==='string'&&/^\S{1,8192}$/u.test(c.taskCapability));
 let taskVerifier,allocationSha256,policyRevision;
 if(complete){taskVerifier=createReadTaskVerifier({...Object.fromEntries(['allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256','scopes','currentOwner','readCurrentEntry','expiresAtMs'].map(k=>[k,c[k]])),approvedReads:config,enabled:c.enabled??false,now,...(c.signal?{signal:c.signal}:{})});allocationSha256=hash(JSON.parse(c.allocationJson));policyRevision=c.scopes[0]?.policyRevision;}
 // Control must supply its canonical gateway. Missing context/broker/installation is absence, never inferred authority.
 const gateway=complete&&c.createReadsRuntime?c.createReadsRuntime(Object.freeze({taskVerifier,taskCapability:c.taskCapability,approvedReads:config})):c.gateway;
 if(types.isPromise(gateway)){Promise.prototype.then.call(gateway,()=>{},()=>{});throw nativeReadFault('CONFIGURATION');}
 const owner=createNativeReadsOwner({binding:c.binding,...(config===undefined?{}:{approvedReads:config}),...(complete?{taskVerifier,allocationSha256,policyRevision,scopes:c.scopes,...(gateway===undefined?{}:{gateway})}:{}),now});
 return Object.freeze({owner,application:createNativeReadsApplication({owner,...(config===undefined?{}:{approvedReads:config}),now})});
}
