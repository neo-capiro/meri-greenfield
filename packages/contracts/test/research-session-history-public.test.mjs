import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {receiveConversationSessionReceipt as session,receiveConversationSessionExpectedContext as expected} from '@capiro/meri-contracts/conversation-session';
import {receiveConversationHistoryRequest as request,receiveConversationHistoryResponse as history} from '@capiro/meri-contracts/conversation-history';
import {assertResearchPortfolioCapture} from '../research-portfolio-scope.mjs';
import {validSessionReceipt} from '../session-receipt/validate.mjs';
import {assertConversationMetadata} from '../conversation-history/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,bytes=v=>new TextEncoder().encode(JSON.stringify(v));
const capture=(changes={})=>{const fields={kind:'research_portfolio',researchPortfolioId:id(5),researchPortfolioName:'Captured portfolio',researchPortfolioRevision:1,...changes};return {...fields,scopeVersion:createHash('sha256').update(JSON.stringify(fields)).digest('hex')};};
const base={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),selectedClientId:null};
const context=()=>({...base,scopeKind:'research_portfolio',scope:capture()});
const receipt=(c=context())=>({credential:'action_session_'+'A'.repeat(43),expiresAtMs:2000,context:c});
const metadata=()=>({conversationId:id(1),title:'Research conversation',status:'active',revision:'1',scopeKind:'research_portfolio',clientId:null,scope:capture(),updatedAt:'2026-10-31T00:00:00.000Z',archivedAt:null,trashedAt:null,restoreUntil:null});

test('Research is an exact independently selected capture, with an explicit private validation opt-in',()=>{
 const c=context(),r=receipt(c);assert.deepEqual(session(bytes(r),bytes(c),1000),r);
 const {runId,...initial}=c;assert.deepEqual(expected(bytes(initial)),initial);assert.deepEqual(session(bytes(r),bytes(initial),1000),r);
 assert.equal(validSessionReceipt(r,1000),false);assert.equal(validSessionReceipt(r,1000,{general:true}),false);
 assert.equal(validSessionReceipt(r,1000,{research:true}),true);assert(Object.isFrozen(session(bytes(r),bytes(c),1000).context.scope));
 assert.throws(()=>expected(bytes({...initial,conversationId:undefined})));
 void runId;
});
test('General/null and Research never correlate in either direction',()=>{
 const general={...base,scopeKind:'general'};
 assert.throws(()=>session(bytes(receipt()),bytes(general),1000));
 assert.throws(()=>session(bytes(receipt(base)),bytes(context()),1000));
 assert.throws(()=>session(bytes(receipt()),bytes(base),1000));
 assert.throws(()=>session(bytes(receipt({...context(),selectedClientId:id(4)})),bytes(context()),1000));
 assert.deepEqual(session(bytes(receipt(base)),bytes(general),1000),receipt(base));
});
test('every original capture field is correlated, never replaced by a fresh observation',()=>{
 const r=receipt();for(const [key,value] of Object.entries({kind:'general',researchPortfolioId:id(6),researchPortfolioName:'Renamed',researchPortfolioRevision:2,scopeVersion:'b'.repeat(64)})){
  assert.throws(()=>session(bytes(r),bytes({...context(),scope:{...capture(),[key]:value}}),1000),key);
  assert.throws(()=>session(bytes({...r,context:{...context(),scope:{...capture(),[key]:value}}}),bytes(context()),1000),key);
 }
 for(const key of Object.keys(capture())){const scope=capture();delete scope[key];assert.throws(()=>expected(bytes({...context(),scope})),key);}
 for(const key of ['currentResearchPortfolioName','currentResearchPortfolioRevision','stale','resourceRevision'])assert.throws(()=>expected(bytes({...context(),scope:{...capture(),[key]:'fresh'}})),key);
});
test('Research rebind retains exact capture and the complete original run selector',()=>{
 const c=context(),target={...c,runId:id(3)},r={...receipt(target),initialRunRebind:{sourceRunId:c.runId,targetRunId:target.runId}};
 assert.deepEqual(session(bytes(r),bytes(c),1000),r);
 assert.throws(()=>session(bytes(r),bytes({...c,runId:undefined}),1000));
 assert.throws(()=>session(bytes(r),bytes({...c,scope:capture({researchPortfolioRevision:2})}),1000));
 assert.throws(()=>session(bytes({...r,context:{...target,scope:capture({researchPortfolioName:'New'})}}),bytes(c),1000));
 assert.throws(()=>session(bytes(r),bytes(target),1000));
});
test('canonical capture bounds and inert snapshot reject malformed data without reading hostile accessors',()=>{
 const c=capture(),snapshot=assertResearchPortfolioCapture(c);c.researchPortfolioName='Mutated';assert.equal(snapshot.researchPortfolioName,'Captured portfolio');assert(Object.isFrozen(snapshot));
 assert.equal(assertResearchPortfolioCapture(capture({researchPortfolioName:'😀'.repeat(200)})).researchPortfolioName.length,400);
 for(const changes of [{researchPortfolioName:''},{researchPortfolioName:' \n\t'},{researchPortfolioName:'😀'.repeat(201)},{researchPortfolioName:'\ud800'},{researchPortfolioRevision:-1},{researchPortfolioRevision:Number.MAX_SAFE_INTEGER+1},{researchPortfolioRevision:1.5},{researchPortfolioId:'INVALID'},{scopeVersion:'A'.repeat(64)},{extra:true}]){
  const value={...capture(),...changes};assert.throws(()=>assertResearchPortfolioCapture(value));assert.throws(()=>expected(bytes({...context(),scope:value})));
 }
 let calls=0;const accessor={...capture()};Object.defineProperty(accessor,'researchPortfolioName',{enumerable:true,get(){calls++;throw Error('getter');}});
 assert.throws(()=>assertResearchPortfolioCapture(accessor));assert.throws(()=>assertResearchPortfolioCapture(new Proxy(capture(),{ownKeys(){calls++;throw Error('proxy');}})));assert.equal(calls,0);
});
test('only Research gets the larger expected-byte ceiling; receipt ceiling and legacy limits remain',()=>{
 const c={...context(),tenantId:'界'.repeat(256),actorId:'界'.repeat(256),scope:capture({researchPortfolioName:'😀'.repeat(200)})};
 assert(bytes(c).length>2048);assert.deepEqual(session(bytes(receipt(c)),bytes(c),1000),receipt(c));
 const pad=value=>new TextEncoder().encode(JSON.stringify(value)+' '.repeat(2500-JSON.stringify(value).length));
 assert.deepEqual(expected(pad(context())),context());assert.throws(()=>expected(pad({...base,scopeKind:'general'})));
 assert.throws(()=>expected(new Uint8Array(4097)));assert.throws(()=>session(new Uint8Array(4097),bytes(context()),1000));
});
test('Research summaries and management retain canonical capture and existing lifecycle/revision checks',async()=>{
 const c=metadata(),q=request('summaries',bytes({version:'meri.conversation-management.v1',status:'active',title:'',before:null}));
 const body={version:'meri.conversation-management.v1',conversations:[{...c,hasTranscript:true,canManage:true}],nextBefore:null};
 assert.deepEqual(await history('summaries',200,bytes(body),q),body);assert.deepEqual(assertConversationMetadata(c),c);
 const manage=request('manage',bytes({version:'meri.conversation-management.v1',requestId:id(9),conversationId:id(1),expectedRevision:'1',operation:'rename',title:'Renamed'}));
 const response={version:'meri.conversation-management.v1',requestId:id(9),conversation:{...c,title:'Renamed',revision:'2'}};
 assert.deepEqual(await history('manage',200,bytes(response),manage),response);
 for(const changes of [{clientId:id(4)},{scope:undefined},{scopeKind:'general'},{scopeKind:'client'},{scope:{...capture(),stale:false}},{archivedAt:'2026-10-31T00:00:00.000Z'},{title:' padded '},{revision:'-1'}]){
  const bad={...c,...changes};assert.throws(()=>assertConversationMetadata(bad));
  await assert.rejects(history('summaries',200,bytes({...body,conversations:[{...bad,hasTranscript:true,canManage:true}]}),q));
 }
 await assert.rejects(history('manage',200,bytes({...response,conversation:{...response.conversation,revision:'3'}}),manage));
});
test('legacy metadata stays capture-free and preserves client/General semantic rejection',()=>{
 const {scope,...rest}=metadata();
 assert.deepEqual(assertConversationMetadata({...rest,scopeKind:'general'}),{...rest,scopeKind:'general'});
 assert.deepEqual(assertConversationMetadata({...rest,scopeKind:'client',clientId:id(4)}),{...rest,scopeKind:'client',clientId:id(4)});
 assert.throws(()=>assertConversationMetadata({...rest,scopeKind:'client'}));assert.throws(()=>assertConversationMetadata({...rest,scopeKind:'general',clientId:id(4)}));
 assert.throws(()=>assertConversationMetadata({...rest,scopeKind:'general',scope}));
});
