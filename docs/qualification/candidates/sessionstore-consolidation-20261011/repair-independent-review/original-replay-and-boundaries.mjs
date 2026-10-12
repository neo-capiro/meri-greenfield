import assert from 'node:assert/strict';
import { createRunBoundSessionStore, copySessionTranscript } from '../../../../../apps/worker/qualification/checkpoint/bound-session-store.mjs';
import { copySessionJson } from '../../../../../apps/worker/qualification/checkpoint/session-store-data.mjs';
import { verifySessionStoreSnapshot } from '../../../../../apps/worker/qualification/checkpoint/verify-session-store.mjs';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = { tenantId: 'synthetic-tenant', actorId: 'synthetic-actor', conversationId: uuid(1), runId: uuid(2), attemptId: uuid(3), workerId: uuid(4), writerFence: 1 };
const scope = {projectKey: '-workspace-conversation', sessionId: uuid(5)};
const calls = [];
const transport = {append: async request => calls.push(request), load: async request => {calls.push(request); return null;}, listSubkeys: async request => {calls.push(request); return [];}};
const owner = createRunBoundSessionStore({binding, sessionKey: scope, transport});
// Original frozen-09b payload definitions; only assertions now expect refusal.
let getterCalls = 0;
const entry = {type: 'system'};
Object.defineProperty(entry, 'text', {enumerable: true, get() {getterCalls++; return 'synthetic';}});
await assert.rejects(owner.store.append(scope, [entry]), /SESSION_NOT_JSON_SAFE/);
assert.equal(getterCalls, 0); assert.equal(calls.length, 0);
let keyReads = 0;
const key = {sessionId: scope.sessionId};
Object.defineProperty(key, 'projectKey', {enumerable: true, get() {return ++keyReads === 1 ? scope.projectKey : 'foreign-project';}});
await assert.rejects(owner.store.append(key, [{type: 'system'}]), /SESSION_KEY_SCOPE/);
await assert.rejects(owner.store.load(key), /SESSION_KEY_SCOPE/);
await assert.rejects(owner.store.listSubkeys(key), /SESSION_KEY_SCOPE/);
assert.throws(() => createRunBoundSessionStore({binding, sessionKey: key, transport}), /SESSION_KEY_SCOPE/);
assert.equal(keyReads, 0); assert.equal(calls.length, 0);
const trap = () => {getterCalls++; throw new Error('must remain inert');};
const proxy = new Proxy({type: 'system'}, {get: trap, ownKeys: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap});
await assert.rejects(owner.store.append(scope, [proxy]), /SESSION_NOT_JSON_SAFE/);
const revoked = Proxy.revocable({type:'system'}, {}); revoked.revoke();
await assert.rejects(owner.store.append(scope, [revoked.proxy]), /SESSION_NOT_JSON_SAFE/);
assert.equal(getterCalls, 0);
const hidden = {type:'system'}; Object.defineProperty(hidden, 'ignored', {value: 1});
const symbolic = {type:'system', [Symbol('ignored')]: 1};
const sparse = new Array(1); const extra = [{type:'system'}]; extra.extra = true;
for (const bad of [hidden, symbolic, Object.create(null), new Date(), -0, NaN, undefined, () => {}, 1n, sparse, extra])
 assert.throws(() => copySessionJson(bad, 10000), /SESSION_NOT_JSON_SAFE/);
const cycle = {}; cycle.self = cycle; assert.throws(() => copySessionJson(cycle, 10000), /SESSION_NOT_JSON_SAFE/);
const shared = {type:'system', content:'opaque'};
assert.deepEqual(copySessionJson([shared, shared], 1000), [shared, shared]);
const utf8 = {text:'é'}; const bytes = Buffer.byteLength(JSON.stringify(utf8));
assert.deepEqual(copySessionJson(utf8, bytes), utf8);
assert.throws(() => copySessionJson(utf8, bytes - 1), /SESSION_PAYLOAD_BOUND/);
assert.equal(copySessionTranscript(Array(100000).fill({type:'system'})).length, 100000);
assert.throws(() => copySessionTranscript(Array(100001).fill({type:'system'})), /SESSION_ENTRY_BOUND/);
let nested = true; for (let i=0; i<512; i++) nested = {child: nested};
const deep = copySessionJson(nested, 10000); let cursor = deep; for (let i=0; i<512; i++) cursor=cursor.child; assert.equal(cursor, true);
class ReceiverTransport {
 #writes = 0;
 append() {this.#writes++;}
 load() {return null;}
 listSubkeys() {return [];}
 writes() {return this.#writes;}
}
const receiver = new ReceiverTransport(); const receiverOwner=createRunBoundSessionStore({binding,sessionKey:scope,transport:receiver});
const pending=receiverOwner.store.append(scope,[{type:'system'}]); receiver.append=trap;
await pending; assert.equal(receiver.writes(), 1); assert.equal(getterCalls,0);
let unknownWrites=0; const unknown=new Error('private detail'); Object.defineProperty(unknown,'code',{get:trap});
const uncertain=createRunBoundSessionStore({binding,sessionKey:scope,transport:{...transport,append:async()=>{unknownWrites++;throw unknown;}}});
await assert.rejects(uncertain.store.append(scope,[{type:'system'}]), /SESSION_TRANSPORT_UNCERTAIN/);
await assert.rejects(uncertain.store.append(scope,[{type:'system'}]), /SESSION_TRANSPORT_UNCERTAIN/);
assert.equal(unknownWrites,1); assert.equal(getterCalls,0);
let responseReads=0;
const responseOwner=createRunBoundSessionStore({binding,sessionKey:scope,transport:{...transport,load:async()=>{responseReads++;return [entry];},listSubkeys:async()=>{responseReads++; const result=['sub'];Object.defineProperty(result,'0',{enumerable:true,get:trap});return result;}}});
await assert.rejects(responseOwner.store.load(scope), /SESSION_NOT_JSON_SAFE/);
await assert.rejects(responseOwner.store.listSubkeys(scope), /SESSION_NOT_JSON_SAFE/);
assert.equal(responseReads,2);assert.equal(getterCalls,0);
const expected={}; Object.defineProperty(expected,'entries',{enumerable:true,get:trap});
await assert.rejects(verifySessionStoreSnapshot(owner.store,scope,[expected]), /SESSION_NOT_JSON_SAFE/);
assert.equal(calls.length,0);assert.equal(getterCalls,0);
const state=await owner.settleObservedCalls(); assert.equal(state.pending,0);
console.log(JSON.stringify({originalStableEntryGetterReads:getterCalls,originalChangingKeyReads:keyReads,originalForeignKeyTransportEffects:calls.length,revokedProxyRefused:true,cyclesAndNonJsonRefused:true,exactUtf8ByteBound:true,fullTranscript100000Accepted:true,entry100001Refused:true,depth512Preserved:true,classReceiverAndCapturedMethodPreserved:true,errorCodeGetterUncertaintyWrites:unknownWrites,transportResponseGetterReads:0,expectedInputEffects:0,pending:state.pending}));
