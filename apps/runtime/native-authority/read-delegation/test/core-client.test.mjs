/** The delegation Core client's wire discipline, and the facts-view migration's CREATE-only shape and plan pin. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createReadDelegationCoreClient,responseLost} from '../core-client.mjs';

const T0=1800000000000,uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const code=expected=>error=>error.message===expected;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
function client(respond=()=>json({schemaVersion:1}),secret='SYNTHETIC_SERVICE'){
 const sent=[];const c=createReadDelegationCoreClient({origin:'https://core.example.invalid',now:()=>T0,enabled:true,getServiceSecret:async()=>secret,
  fetchImpl:async(url,init)=>{sent.push({path:new URL(url).pathname,init});return respond(url,init);}});
 return {c,sent};
}
const attended={schemaVersion:1,mode:'attended'},unattended={schemaVersion:1,mode:'unattended'};

test('fixed bearer use per route: live session only on attended create; service identity on every call; tokens only on targets',async()=>{
 const {c,sent}=client();
 await c.create({request:attended,liveCredential:'SYNTHETIC_LIVE',deadlineMs:T0+1000});
 await c.create({request:unattended,deadlineMs:T0+1000});
 await c.issueToken({delegationId:uuid('1'),request:{schemaVersion:1},deadlineMs:T0+1000});
 await c.revoke({delegationId:uuid('1'),reason:'cancelled',deadlineMs:T0+1000});
 await c.target({path:'/api/clio/tools/search_tracked_bills',body:Buffer.from('{}'),token:'synthetic-read-token',deadlineMs:T0+1000});
 assert.deepEqual(sent.map(s=>s.init.headers.authorization),['Bearer SYNTHETIC_LIVE',undefined,undefined,undefined,'CapiroMeriRead synthetic-read-token']);
 for(const s of sent){assert.equal(s.init.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');assert.equal(s.init.redirect,'error');assert.equal(s.init.credentials,'omit');assert.equal(s.init.cache,'no-store');}
 assert.deepEqual(sent.map(s=>s.path),['/api/clio/application-authority/read-delegations','/api/clio/application-authority/read-delegations',
  `/api/clio/application-authority/read-delegations/${uuid('1')}/tokens`,`/api/clio/application-authority/read-delegations/${uuid('1')}/revocations`,'/api/clio/tools/search_tracked_bills']);
});

test('refusals map to fixed codes; only transport losses and 5xx are marked as lost responses',async()=>{
 for(const [status,expected] of [[401,'UNAVAILABLE'],[403,'ACCESS_DENIED'],[409,'ACCESS_DENIED'],[410,'UNAVAILABLE'],[429,'RESOURCE_LIMIT'],[404,'UNAVAILABLE']]){
  const {c}=client(()=>json({},status));const error=await c.issueToken({delegationId:uuid('1'),request:{},deadlineMs:T0+1000}).catch(e=>e);
  assert.equal(error.message,expected,String(status));assert.equal(responseLost(error),false,String(status));
 }
 for(const respond of [()=>json({},503),()=>{throw TypeError('socket');}]){
  const {c}=client(respond);const error=await c.issueToken({delegationId:uuid('1'),request:{},deadlineMs:T0+1000}).catch(e=>e);assert.equal(responseLost(error),true);
 }
});

test('bounded bodies; the service secret is never sent as a bearer; no client without a service identity',async()=>{
 const {c,sent}=client();
 await assert.rejects(c.issueToken({delegationId:uuid('1'),request:{pad:'x'.repeat(16384)},deadlineMs:T0+1000}),code('RESOURCE_LIMIT'));
 await assert.rejects(c.create({request:attended,liveCredential:'SYNTHETIC_SERVICE',deadlineMs:T0+1000}),code('UNAVAILABLE'));
 await assert.rejects(c.create({request:attended,deadlineMs:T0+1000}),code('UNAVAILABLE'),'attended create needs a live session');
 assert.equal(sent.length,0);
 const off=createReadDelegationCoreClient({origin:'https://core.example.invalid',now:()=>T0,enabled:true,fetchImpl:async()=>json({})});assert.equal(off.available,false);
 await assert.rejects(off.revoke({delegationId:uuid('1'),reason:'cancelled',deadlineMs:T0+1000}),code('UNAVAILABLE'));
});

const MIGRATION=new URL('../migrations/0001_read_delegation_facts.sql',import.meta.url);
const READ_DELEGATION_FACTS_SHA256='700663d7b788ba594c2ebd3df7c197949a471e6382ce4a98d94ce038fa9b03eb';
test('the facts-view migration is CREATE-only over the product namespace and matches its plan pin',()=>{
 const bytes=readFileSync(MIGRATION),sql=bytes.toString('utf8'),code=sql.split('\n').filter(line=>!line.startsWith('--')).join('\n');
 assert.match(code,/^BEGIN;/mu);assert.match(code,/COMMIT;\s*$/u);
 for(const forbidden of [/\bDROP\b/iu,/\bALTER\b/iu,/\bGRANT\b/iu,/\bINSERT\b/iu,/\bUPDATE\b/iu,/\bDELETE\b/iu,/\bTRUNCATE\b/iu,/meri_qualification/iu])assert.doesNotMatch(code,forbidden,String(forbidden));
 assert.equal((code.match(/CREATE VIEW meri_read_delegation_facts\.\w+ WITH \(security_barrier = true\)/gu)??[]).length,4);
 // Row existence is never authority: the canonical admission predicate is exposed for Core to require.
 assert.match(code,/AS admitted,/u);assert.match(code,/AS admitted_until,/u);assert.match(code,/gr\.state = 'ACTIVE'/u);assert.match(code,/quarantined/u);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),READ_DELEGATION_FACTS_SHA256);
});
