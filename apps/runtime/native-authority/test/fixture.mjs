import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {createDurableSdkSessionOwner} from '../../sdk-session-owner.mjs';
import {ProductError,productFailure} from '../../../control/product-access/errors.mjs';
export const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,NOW=Date.parse('2026-10-13T20:00:00Z');
export function fixture(options={}){let currentChange={};let state={owner:null,streams:new Map(),entries:[],batches:new Map()},calls=0,verifies=0,revoked=false,unknown=false,at=NOW,expiry=NOW+4000;const binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},key={projectKey:'observed.SDK.key:unchanged',sessionId:id(5)},scopes=[{tenantId:'synthetic',kind:'client',resourceId:id(6),policyRevision:'policy'}];
 const execution={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:NOW+5000,runtimeSessionId:'synthetic-session-11111111111111111111'};
 const client={async query(sql,a){calls++;
  if(sql.startsWith('SELECT session_id,project_key FROM meri_conversations.sdk_sessions'))return {rows:state.owner?[{session_id:state.owner.session_id,project_key:state.owner.project_key}]:[]};
  if(sql.startsWith('SELECT * FROM meri_conversations.sdk_sessions'))return {rows:state.owner?[structuredClone(state.owner)]:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.sdk_sessions')){state.owner={tenant_id:a[0],conversation_id:a[1],run_id:a[2],session_id:a[3],project_key:a[4],owner:a[5],owner_sha256:a[6],entries_count:0,bytes:0};return {rows:[]};}
  if(sql.startsWith('SELECT subpath'))return {rows:[...state.streams.keys()].sort().map(subpath=>({subpath}))};
  if(sql.startsWith('SELECT * FROM meri_conversations.sdk_session_streams'))return {rows:state.streams.has(a[4])?[structuredClone(state.streams.get(a[4]))]:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.sdk_session_streams')){state.streams.set(a[4],{tenant_id:a[0],conversation_id:a[1],run_id:a[2],session_id:a[3],subpath:a[4],last_sequence:0});return {rows:[]};}
  if(sql.startsWith('SELECT * FROM meri_conversations.sdk_session_entries'))return {rows:state.entries.filter(e=>e.subpath===a[4]&&(a.length===5||e.entry_uuid===a[5])).map(e=>structuredClone(e))};
  if(sql.startsWith('INSERT INTO meri_conversations.sdk_session_entries')){state.entries.push({tenant_id:a[0],conversation_id:a[1],run_id:a[2],session_id:a[3],subpath:a[4],sequence:a[5],entry_uuid:a[6],entry:structuredClone(a[7]),entry_sha256:a[8]});return {rows:[]};}
  if(sql.startsWith('SELECT * FROM meri_conversations.sdk_session_batches'))return {rows:state.batches.has(a[4])?[structuredClone(state.batches.get(a[4]))]:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.sdk_session_batches')){state.batches.set(a[4],{tenant_id:a[0],conversation_id:a[1],run_id:a[2],session_id:a[3],append_id:a[4],request_sha256:a[5],receipt:structuredClone(a[6]),receipt_sha256:a[7]});return {rows:[]};}
  if(sql.startsWith('UPDATE meri_conversations.sdk_session_streams')){state.streams.get(a[4]).last_sequence=a[5];return {rows:[]};}
  if(sql.startsWith('UPDATE meri_conversations.sdk_sessions')){state.owner.entries_count=a[4];state.owner.bytes=a[5];return {rows:[]};}throw Error('Unexpected fixture SQL');}};
 const admission={async withCurrentRun(call,effect){if(options.park)return new Promise(()=>{});assert.deepEqual(call.binding,binding);const before=structuredClone(state);try{const result=await effect({client,current:{binding,policyRevision:'policy',scopes,executionSha256:hash(execution),executionPhase:'started',deadlineMs:NOW+5000,checkedAtMs:NOW,...currentChange}});if(unknown)throw new ProductError('STORE_COMMIT_UNKNOWN','UNKNOWN');return result;}catch(e){if(productFailure(e)?.outcome!=='UNKNOWN')state=before;throw e;}}};
 const authority={async authenticate(call){verifies++;if(revoked||call.credential!=='opaque-native-task')throw Error('Execution refused');return {execution,versions,state:'running',scopes,selectedClientId:id(6),policyRevision:'policy'};}};
 const owner=createDurableSdkSessionOwner({admission,authority,enabled:true,now:()=>at,maxRequestMs:options.maxRequestMs??3000});const invoke=(op,extra={})=>owner[op]({credential:'opaque-native-task',request:{binding,key,...extra}});return {owner,binding,key,invoke,state:()=>state,calls:()=>calls,verifies:()=>verifies,revoke(){revoked=true;},unknown(v){unknown=v;},setClock(v){at=v;},setExpiry(v){expiry=v;},changeCurrent(v){currentChange=v;},admission};}
