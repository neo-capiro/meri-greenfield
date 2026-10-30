/** The REAL browser-call dispatch path: createBrowserOperations + the real operation owner + the real
 * intent journal store over an inert SQL boundary, with a counting host-effect boundary. No database,
 * no socket, no host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createBrowserOperations} from '../browser-operations.mjs';
import {createBrowserOperationOwner} from '../../control/intents/browser-operation-owner.mjs';
import {createIntentJournal} from '../../control/intents/journal.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {browserExecutionDeliveryId} from '../../../packages/contracts/runtime-0.2/browser-operation.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../worker/conversation/browser/policy.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const requestId='a1b2'.repeat(16);
const policy={...DEFAULT_BROWSER_POLICY,allowedOrigins:['https://app.example']};

/** Inert SQL boundary for meri_intents.preparations. It records statement order so the test can prove
 * the claim acknowledgement precedes the effect. */
function intentPool({loseCommit=false,refuseSettle=false}={}){
 const rows=new Map(),log=[];
 const keyOf=(t,a,c,d)=>JSON.stringify([t,a,c,d]);
 const client={async query(sql,p=[]){
  const text=String(sql);
  if(/^(BEGIN|SET LOCAL|COMMIT|ROLLBACK)/u.test(text)){
   if(!text.startsWith('SET LOCAL'))log.push(text==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'?'BEGIN':text);
   if(loseCommit&&text==='COMMIT')throw Object.assign(Error('ack lost'),{code:'STORE_COMMIT_UNKNOWN'});
   return {rows:[]};}
  if(text.startsWith('INSERT INTO meri_intents.preparations')){
   log.push('claim');const id=keyOf(p[0],p[1],p[2],p[3]);
   if(rows.has(id))return {rows:[]};
   const record=JSON.parse(p[4]),row={record,record_sha256:p[5],state:'PENDING',outcome:null};
   rows.set(id,row);return {rows:[{...row}]};}
  if(text.startsWith('SELECT record,record_sha256,state,outcome FROM meri_intents.preparations')){
   const row=rows.get(keyOf(p[0],p[1],p[2],p[3]));
   return {rows:row?[{...row}]:[]};}
  if(text.startsWith('UPDATE meri_intents.preparations')){
   log.push('settle');if(refuseSettle)throw Object.assign(Error('denied'),{code:'INTENT_JOURNAL_STATE'});
   const id=keyOf(p[0],p[1],p[2],p[3]),row=rows.get(id);
   if(!row||row.record_sha256!==p[4]||row.state!=='PENDING')return {rows:[]};
   const next={...row,state:p[5],outcome:p[6]===null?null:JSON.parse(p[6])};rows.set(id,next);return {rows:[{...next}]};}
  return {rows:[]};
 },release(){}};
 const pool={async connect(){return client;}};
 return {pool,rows,log,keyOf};
}

function harness({poolOptions={},clock={now:NOW}}={}){
 const sql=intentPool(poolOptions);
 const custody=createBrowserOperationOwner({journal:createIntentJournal(createPostgresIntentJournalStore({pool:sql.pool})),
  now:()=>clock.now});
 const effects=[];
 const hosts={async executeBrowserOperation(operation,input,options){effects.push({operation,input,options});return {ok:true,tool:input.tool};}};
 let policyNow=policy;
 const operations=createBrowserOperations({hosts,custody,now:()=>clock.now,
  readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:clock.now,expiresAtMs:clock.now+60000}),
  readBrowserPolicy:async()=>policyNow});
 const call={operation:'browser-call',request:{binding,requestId,tool:'browser_click',args:{selector:'#go'}},
  execution:{expiresAtMs:NOW+60000},scopes};
 return {sql,custody,effects,operations,call,clock,setPolicy:value=>{policyNow=value;}};
}
const delivered=async(h,{signal}={})=>{
 const prepared=await h.operations.prepare(h.call);
 return prepared.execute({signal});
};

test('the SQL claim acknowledgement precedes exactly one host effect',async()=>{
 const h=harness();
 const response=await delivered(h,{signal:new AbortController().signal});
 assert.deepEqual(response.result,{ok:true,tool:'browser_click'});
 assert.equal(h.effects.length,1,'exactly one effect');
 assert.deepEqual(h.sql.log.slice(0,3),['BEGIN','claim','COMMIT'],'claim commits before the effect');
 assert.deepEqual(h.sql.log.slice(3),['BEGIN','settle','COMMIT'],'the settlement follows the effect');
 // The stored row is the browser execution family with the exact two-key record.
 const [row]=[...h.sql.rows.values()];
 assert.equal(row.state,'PREPARED');
 assert.deepEqual(Object.keys(row.record).sort(),['argumentsSha256','operation']);
 assert.deepEqual(row.record.operation,{id:'browser_action',version:'0.2.0'});
 // The row is keyed by the domain-separated EXECUTION delivery identity, not an approval id.
 const [storedKey]=[...h.sql.rows.keys()];
 assert.ok(storedKey.includes(browserExecutionDeliveryId({binding,requestId})),'stored under the execution delivery id');
});

test('a repeated call replays the retained result and never dispatches again',async()=>{
 const h=harness();
 await delivered(h);
 const again=await delivered(h);
 assert.deepEqual(again.result,{ok:true,tool:'browser_click'});
 assert.equal(h.effects.length,1);
 // The replay is released only while its window is current.
 h.clock.now=NOW+120000;
 await assert.rejects(delivered(h),{message:'BROWSER_OPERATION_UNAVAILABLE'});
 assert.equal(h.effects.length,1);
});

test('a changed request under the same identity refuses and never dispatches',async()=>{
 const h=harness();
 await delivered(h);
 h.call.request={...h.call.request,args:{selector:'#delete'}};
 await assert.rejects(delivered(h),{message:'BROWSER_OPERATION_UNKNOWN'});
 assert.equal(h.effects.length,1);
});

test('a cancelled signal releases no replay and reaches no effect',async()=>{
 const h=harness();
 const controller=new AbortController();
 controller.abort();
 await assert.rejects(delivered(h,{signal:controller.signal}));
 assert.equal(h.effects.length,0);
 // Cancel AFTER a successful claim: the effect is not started by a second call either.
 const h2=harness();
 await delivered(h2);
 const controller2=new AbortController();controller2.abort();
 await assert.rejects(delivered(h2,{signal:controller2.signal}));
 assert.equal(h2.effects.length,1);
});

test('an unavailable custody dependency refuses the browser-call effect',async()=>{
 const effects=[];
 const hosts={async executeBrowserOperation(){effects.push(1);return {ok:true};}};
 const operations=createBrowserOperations({hosts,now:()=>NOW,custody:null,
  readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:NOW,expiresAtMs:NOW+60000}),
  readBrowserPolicy:async()=>policy});
 const prepared=await operations.prepare({operation:'browser-call',
  request:{binding,requestId,tool:'browser_click',args:{}},execution:{expiresAtMs:NOW+60000},scopes});
 await assert.rejects(prepared.execute({signal:new AbortController().signal}),{message:'BROWSER_OPERATION_UNAVAILABLE'});
 assert.equal(effects.length,0,'no unclaimed effect was dispatched');
});

test('a lost settlement acknowledgement reports UNKNOWN rather than success',async()=>{
 const h=harness({poolOptions:{refuseSettle:true}});
 // The claim commits; the effect runs; the settlement is refused, so no success is reported.
 await assert.rejects(delivered(h),{message:'BROWSER_OPERATION_UNKNOWN'});
 assert.equal(h.effects.length,1);
 const [row]=[...h.sql.rows.values()];
 assert.equal(row.state,'PENDING','the delivery stays unresolved for reconciliation');
});

test('a lost COMMIT on the claim never dispatches',async()=>{
 const h=harness({poolOptions:{loseCommit:true}});
 await assert.rejects(delivered(h),{message:'BROWSER_OPERATION_UNKNOWN'});
 assert.equal(h.effects.length,0);
});

test('the real runtime construction supplies the custody owner to browser operations',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../control.mjs',import.meta.url),'utf8');
 assert.match(source,/createBrowserOperationOwner\(\{journal:createIntentJournal\(createPostgresIntentJournalStore\(\{pool\}\)\),now\}\)/u);
 assert.match(source,/createBrowserOperations\(\{hosts:ports\.browserHosts,readCapabilityRole,readBrowserPolicy,custody:browserCustody,now\}\)/u);
 assert.match(source,/createBrowserReceiptProducer\(\{store,now\}\)/u);
 assert.match(source,/browserCustody,browserReceipts,/u);
});
