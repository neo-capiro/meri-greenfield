/** Synthetic task facts only: the relay must preserve the existing delegation's per-call authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createRetainedReadCredentialRelay} from '../retained-read-credential-relay.mjs';
import {clientEvidenceFixture,operations as evidenceOperations} from '../../../gateway/sources/client-evidence/test/fixtures.mjs';
import {createIdentityContactsFixture} from '../../../gateway/sources/identity-contacts/test/fixtures.mjs';
import {createClientKnowledgeFixture} from '../../../gateway/sources/client-knowledge/test/fixtures.mjs';

const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const refused=error=>['ACCESS_DENIED','UNAVAILABLE'].includes(error.message);

function sourcePins(f){
 const operation=f.operation,input=typeof f.input==='function'?f.input():f.input;
 const metadata=Object.hasOwn(f,'metadata')?f.metadata:
  typeof f.normalize==='function'?f.normalize().metadata:f.normalized().metadata;
 const context=f.normalizationContext,withContext=new Set(['read_monday_client_boards','get_client_context',
  'read_client_documents','resolve_entity','find_contacts']).has(operation.id);
 const binding=f.authority.binding,subject=f.authority.subject,policyRevision=f.authority.policyRevision;
 const normalizationContext=operation.id==='find_contacts'||!withContext?null:context;
 const correlation=canonicalize({binding,subject,policyRevision,normalizationContext});
 const body=JSON.stringify({input,metadata});
 return {operation,input,metadata,argumentsSha256:canonicalSha256(input),
  requestSha256:canonicalSha256({input,metadata}),binding,subject,policyRevision,
  sourceIds:f.authority.sourceIds,invocationId:'synthetic_read_slot',deadlineMs:Date.parse(f.authority.claims.expiresAt),
  target:{method:'POST',path:`/api/clio/tools/${operation.id}`,bodySha256:sha(body)},
  correlationSha256:sha(correlation),signal:undefined,...(withContext?{normalizationContext:context}:{})};
}

function relayFixture(f){
 const pins=sourcePins(f),clock={at:Date.parse(f.authority.decision.evaluatedAt)},calls={secret:0,handle:[],tool:[]};
 const stop=new AbortController();
 const task={binding:pins.binding,scopes:pins.subject.scopes,
  grant:{qualificationBinding:{policyRevision:pins.policyRevision}},
  original:{binding:pins.binding,expiresAtMs:pins.deadlineMs},
  allocation:{manifest:{allowedOperations:[pins.operation]}},
  approvedReads:{operations:[pins.operation]},signal:undefined};
 const nativeCredentials={stopSignal:stop.signal,
  async getNativeCredential(request){calls.handle.push(request);return {credential:'opaque-synthetic-handle',expiresAtMs:pins.deadlineMs-1000};},
  async toolCredential(request){calls.tool.push(request);return {bearerToken:'synthetic-single-use-token',authorizationScheme:'CapiroMeriRead',expiresAtMs:pins.deadlineMs-2000};}};
 const getServiceSecret=async()=>{calls.secret++;return 'synthetic-service-secret';};
 const create=(changes={})=>createRetainedReadCredentialRelay({task,nativeCredentials,getServiceSecret,now:()=>clock.at,...changes});
 return {f,pins,clock,calls,task,nativeCredentials,stop,getServiceSecret,create};
}

test('profile receipt binds exact input/body/correlation, selected client and one invocation token',async()=>{
 const x=relayFixture(clientEvidenceFixture()),receipt=await x.create()(x.pins);
 const {input,deadlineMs,signal,...echo}=x.pins;
 assert.deepEqual(receipt,{operation:x.pins.operation,argumentsSha256:x.pins.argumentsSha256,
  metadata:x.pins.metadata,normalizationContext:x.pins.normalizationContext,
  requestSha256:x.pins.requestSha256,binding:x.pins.binding,subject:x.pins.subject,
  policyRevision:x.pins.policyRevision,sourceIds:x.pins.sourceIds,invocationId:x.pins.invocationId,
  authorizationScheme:'CapiroMeriRead',target:x.pins.target,correlationSha256:x.pins.correlationSha256,
  bearerToken:'synthetic-single-use-token',serviceSecret:'synthetic-service-secret',expiresAtMs:deadlineMs-2000});
 assert.equal(x.calls.secret,1);assert.equal(x.calls.handle.length,1);assert.equal(x.calls.tool.length,1);
 assert.equal(x.calls.handle[0].callKey,x.pins.invocationId);
 assert.deepEqual(x.calls.handle[0].binding,x.pins.binding);
 assert.deepEqual(x.calls.tool[0].target,x.pins.target);
 assert.equal(x.calls.tool[0].argumentsSha256,canonicalSha256(input));
 assert.equal(x.calls.tool[0].correlationSha256,x.pins.correlationSha256);
 assert.equal(echo.operation.id,evidenceOperations.profile.id);
});

test('document and selected-client contacts use their exact different correlation contexts',async()=>{
 for(const f of [clientEvidenceFixture(evidenceOperations.documents),createIdentityContactsFixture('find_contacts',{linked:true})]){
  const x=relayFixture(f),receipt=await x.create()(x.pins);
  assert.equal(receipt.authorizationScheme,'CapiroMeriRead');
  assert.deepEqual(receipt.normalizationContext,x.pins.normalizationContext);
  assert.equal(receipt.correlationSha256,x.pins.correlationSha256);
  assert.equal(x.calls.tool.length,1);
 }
});

test('wrong task, operation, input and signed target pins refuse before any token or secret',async()=>{
 const x=relayFixture(clientEvidenceFixture()),base=x.pins;
 const wrong=[
  {name:'operation version',value:{...base,operation:{...base.operation,version:'0.2.0'}}},
  {name:'unallocated operation',value:{...base,operation:{id:'read_client_documents',version:'0.2.0'}}},
  {name:'missing invocation',value:(({invocationId:ignored,...rest})=>rest)(base)},
  {name:'binding',value:{...base,binding:{...base.binding,writerFence:2}}},
  {name:'selected client',value:{...base,input:{...base.input,clientId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}},
  {name:'subject client',value:{...base,subject:{...base.subject,entityIds:['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']}}},
  {name:'subject scope',value:{...base,subject:{...base.subject,scopes:[]}}},
  {name:'personal subject',value:{...base,subject:{...base.subject,kind:'personal',entityType:'user',entityIds:[base.binding.actorId]}}},
  {name:'policy',value:{...base,policyRevision:'foreign-policy'}},
  {name:'source',value:{...base,sourceIds:['foreign-source']}},
  {name:'arguments hash',value:{...base,argumentsSha256:'0'.repeat(64)}},
  {name:'request hash',value:{...base,requestSha256:'0'.repeat(64)}},
  {name:'target path',value:{...base,target:{...base.target,path:'/api/clio/tools/other'}}},
  {name:'target body',value:{...base,target:{...base.target,bodySha256:'0'.repeat(64)}}},
  {name:'correlation hash',value:{...base,correlationSha256:'0'.repeat(64)}},
  {name:'correlation context',value:{...base,normalizationContext:{...base.normalizationContext,asOf:'2025-01-01T00:00:00.000Z'}}},
 ];
 for(const {name,value} of wrong)await assert.rejects(x.create()(value),refused,name);
 assert.equal(x.calls.secret,0);assert.equal(x.calls.handle.length,0);assert.equal(x.calls.tool.length,0);
});

test('Option A cannot become a signed Core source credential',async()=>{
 const x=relayFixture(clientEvidenceFixture()),nativeCredentials={...x.nativeCredentials,async toolCredential(request){x.calls.tool.push(request);return null;}};
 await assert.rejects(x.create({nativeCredentials})(x.pins),{message:'UNAVAILABLE'});
 assert.equal(x.calls.tool.length,1);
});

test('Stop and expiry refuse before token acquisition, including Stop during secret retrieval',async()=>{
 const stopped=relayFixture(clientEvidenceFixture());stopped.stop.abort();
 await assert.rejects(stopped.create()(stopped.pins),{message:'UNAVAILABLE'});
 assert.equal(stopped.calls.secret,0);assert.equal(stopped.calls.tool.length,0);
 const expired=relayFixture(clientEvidenceFixture()),expiredRelay=expired.create();expired.clock.at=expired.pins.deadlineMs;
 await assert.rejects(expiredRelay(expired.pins),{message:'UNAVAILABLE'});
 assert.equal(expired.calls.secret,0);assert.equal(expired.calls.tool.length,0);
 const waiting=relayFixture(clientEvidenceFixture());
 const getServiceSecret=async()=>{waiting.stop.abort();return 'synthetic-service-secret';};
 await assert.rejects(waiting.create({getServiceSecret})(waiting.pins),{message:'UNAVAILABLE'});
 assert.equal(waiting.calls.handle.length,0);assert.equal(waiting.calls.tool.length,0);
});

test('Monday refuses until current managed board mapping exists, before secret or token',async()=>{
 const x=relayFixture(createClientKnowledgeFixture('read_monday_client_boards'));
 await assert.rejects(x.create()(x.pins),{message:'UNAVAILABLE'});
 assert.equal(x.calls.secret,0);assert.equal(x.calls.handle.length,0);assert.equal(x.calls.tool.length,0);
});
