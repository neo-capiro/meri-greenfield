/** Reads of canonical committed memory that a correction proposal needs: the exact target and its content hash. Core owns memory;
 * these reads decide nothing and only feed eligibility (`eligibility.mjs`) and the candidate's `corrects` pin. */
import {refuse} from '../product-access/errors.mjs';
import {SHA256,UUID,closed,text} from '../product-access/shape.mjs';
import {MEMORY_STATES} from './eligibility.mjs';
import {MEMORY_SCOPES} from './wire.mjs';
const TARGET=['tenantId','memoryId','memorySha256','scope','clientId','ownerActorId','key','state'];
function target(raw,tenantId){
 const t=closed(raw,TARGET,[],'MEMORY_TARGET_UNAVAILABLE');
 if(t.tenantId!==tenantId||!text(t.memoryId,1,128)||!SHA256.test(t.memorySha256)||!MEMORY_SCOPES.includes(t.scope)||!MEMORY_STATES.includes(t.state)||
  (t.scope==='client')!==(typeof t.clientId==='string'&&UUID.test(t.clientId))||t.scope!=='client'&&t.clientId!==null||
  (t.scope==='personal')!==(typeof t.ownerActorId==='string'&&text(t.ownerActorId,1,128))||t.scope!=='personal'&&t.ownerActorId!==null||!(t.key===null||text(t.key,1,120)))refuse('MEMORY_TARGET_UNAVAILABLE');
 return t;
}
export function createCoreMemoryReads({transport}){
 if(typeof transport?.call!=='function')refuse('PRODUCT_CONFIGURATION');
 return Object.freeze({
  async readTarget({tenantId,actorId,memoryId,signal,deadlineMs}){
   const raw=closed(await transport.call('target',{tenantId,actorId,body:{memoryId},signal,deadlineMs},'MEMORY_TARGET_UNAVAILABLE'),['memory'],[],'MEMORY_TARGET_UNAVAILABLE');
   if(raw.memory===null)refuse('MEMORY_TARGET_NOT_FOUND');
   const t=target(raw.memory,tenantId);if(t.memoryId!==memoryId)refuse('MEMORY_TARGET_UNAVAILABLE');return t;
  },
  /** The committed memory a keyed conversational proposal would replace, or null when none exists in that scope. */
  async findByKey({tenantId,actorId,scope,clientId,key,signal,deadlineMs}){
   const raw=closed(await transport.call('findByKey',{tenantId,actorId,body:{scope,clientId,key},signal,deadlineMs},'MEMORY_TARGET_UNAVAILABLE'),['memory'],[],'MEMORY_TARGET_UNAVAILABLE');
   if(raw.memory===null)return null;
   const t=target(raw.memory,tenantId);if(t.key!==key||t.scope!==scope||t.clientId!==clientId)refuse('MEMORY_TARGET_UNAVAILABLE');return t;
  },
 });
}
