import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createConversationRetentionInventory} from '../retention-inventory.mjs';

const subject=()=>({tenantId:'synthetic-tenant',conversationId:randomUUID(),ownerActorId:'synthetic-actor'});

test('a late pool lease is refused and retired after the inventory deadline',async()=>{
 let resolveLease,released;
 const pool={connect:()=>new Promise(resolve=>{resolveLease=resolve;})};
 const pending=createConversationRetentionInventory({pool}).inventoryForConversation(subject(),
  {deadlineMs:Date.now()+60});
 await assert.rejects(pending,/RETENTION_INVENTORY_EXPIRED/);
 resolveLease({release:error=>{released=error;}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(released?.message??'',/RETENTION_INVENTORY_EXPIRED/);
});

test('a stalled query retires its borrowed connection without a concurrent rollback',async()=>{
 const seen=[];
 const pool={async connect(){return {query:sql=>{seen.push(sql);return new Promise(()=>{});},
  release:error=>{seen.push(error?.code??'reusable');}};}};
 await assert.rejects(createConversationRetentionInventory({pool}).inventoryForConversation(subject(),
  {deadlineMs:Date.now()+60}),/RETENTION_INVENTORY_EXPIRED/);
 assert.deepEqual(seen,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY','RETENTION_INVENTORY_EXPIRED']);
});
