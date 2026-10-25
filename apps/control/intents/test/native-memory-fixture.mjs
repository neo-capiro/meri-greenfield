/** Real governed producer/source/preparer and outer intent journal; synthetic Core, storage and current-rights ports. */
import {createMemoryIntentPreparer,MEMORY_COMMAND_OPERATION as operation} from '../../memory/command-options.mjs';
import {createMemoryCommandSource} from '../../memory/command-source.mjs';
import {createMemoryProducer} from '../../memory/producer.mjs';
import {createCoreReview} from '../../memory/core-review.mjs';
import {createCoreMemoryReads} from '../../memory/core-memory.mjs';
import {createCoreDouble,createJournalDouble,principal,NOW,id,ids,CLIENT_A} from '../../memory/test/fixtures.mjs';
import {createIntentMount} from '../mount.mjs';
import {createMemoryJournalStore,delivery} from './fixture.mjs';
export {operation,NOW,id,delivery};
export function nativeMemoryFixture({general=false}={}){
 const binding={tenantId:'tenant-one',actorId:'actor-1',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const selectedClientId=general?null:CLIENT_A,policyRevision='policy-1';
 const scopes=[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:CLIENT_A,policyRevision}];
 const state={now:NOW,prepares:0,revoked:false,loseProducerAck:false,afterPrepare:null,mutate:null};
 const journal=createJournalDouble(),core=createCoreDouble(),intentStore=createMemoryJournalStore();
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),newId:ids(300),now:()=>state.now});
 const source=createMemoryCommandSource({binding,scopes,selectedClientId,policyRevision,now:()=>state.now,maxRequestMs:9000,deadlineMs:NOW+60000,
  async readCurrent(){if(state.revoked)throw Error('revoked');return {binding,scopes,selectedClientId,policyRevision,checkedAtMs:state.now,expiresAtMs:NOW+60000};},
  async producerFor(){return {principal:principal(),expiresAtMs:NOW+60000,producer:{async proposeFromCommand(args){const out=await producer.proposeFromCommand(args);if(state.loseProducerAck)throw Error('lost producer ACK');return out;}},async recheck(){if(state.revoked)throw Error('revoked');}};}});
 const preparer=createMemoryIntentPreparer({source,binding,scopes,selectedClientId,newId:ids(100)});
 const resultRelease={async check({selection,selectionSha256}){if(state.revoked)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:state.now,expiresAtMs:NOW+60000};}};
 const newMount=(current=binding)=>createIntentMount({binding:current,preparers:[{...preparer,binding:current,async prepare(args){state.prepares++;let result=await preparer.prepare(args);await state.afterPrepare?.();return state.mutate?state.mutate(result):result;}}],journalStore:intentStore.port,resultRelease,now:()=>state.now,limits:{maxRequestMs:5000},enabled:true});
 const raw={content:'Remember this preference',scope:general?'personal':'client'},call={operation,arguments:raw,deliveryId:delivery(1)};
 return {binding,scopes,state,core,journal,intentStore,newMount,raw,call,port:newMount(),now:()=>state.now,deadlineMs:NOW+60000};
}
