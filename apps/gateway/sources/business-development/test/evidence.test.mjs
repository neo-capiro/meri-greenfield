/** Stored dossier producer contract over synthetic HTTP only; no Core/DB/provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {captureBusinessDevelopmentResource} from '../request-context.mjs';
import {createBusinessDevelopmentHandlers} from '../handler.mjs';
import {storedCase,evidenceId,clientId,conversationId} from './fixture.mjs';

test('evidence: existing native read route preserves complete stored facts, identity basis and provenance',async()=>{
 const f=storedCase(evidenceId),call=f.call();
 f.state.credentialMutator=proof=>{proof.authorizationScheme='CapiroMeriRead';};
 const result=JSON.parse(await f.handler()(call)),wire=f.wire[0],proof=f.credentialCalls[0];
 assert.deepEqual(result,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,
  argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${evidenceId}`);
 assert.deepEqual(wire.body,{conversationId});assert.equal(wire.options.method,'POST');
 assert.equal(wire.options.headers.authorization,'CapiroMeriRead SYNTHETIC_NATIVE_USER');
 assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.deepEqual(proof.target,{method:'POST',path:`/api/clio/tools/${evidenceId}`,
  bodySha256:createHash('sha256').update(wire.options.body,'utf8').digest('hex')});
 assert.equal(proof.argumentsSha256,canonicalSha256(call.input));
 assert.deepEqual(captureBusinessDevelopmentResource(f.operation,f.arguments,f.authority.subject),{conversationId,clientId});
 assert.equal(result.result.data[0].facts.amount,123.45);assert.equal(result.result.data[0].relationshipStrength,'conditional');
 assert.equal(result.result.data[0].retrievedAt,null);assert.equal(result.result.data[0].sourceUpdatedAt,null);
 for(const key of ['absenceEvidence','providerQualified','nextCursor'])assert.equal(Object.hasOwn(result.result,key),false);
});

test('evidence: capped record windows, unavailable sections and factual omission flags stay partial',async()=>{
 const f=storedCase(evidenceId),page=structuredClone(f.page),row=page.data[0];
 page.data=Array.from({length:24},(_,n)=>({...row,id:`record-${n}`,recordId:`record-${n}`}));
 page.evidence={total:30,returned:24,truncated:true};
 page.sectionStates.push({section:'relevant_signals',status:'error',statusText:'Synthetic source unavailable'});
 page.data[0].factsOmitted=['amount'];delete page.data[0].facts.amount;
 page.data[0].factsOmittedNote='These factual fields were too large to include exactly and were omitted rather than cut; treat them as unsupported here.';
 page.coverage={complete:false,partial:true,note:'Synthetic partial stored records.'};
 f.state.page=page;
 const result=JSON.parse(await f.handler()(f.call())).result;
 assert.deepEqual(result,page);assert.equal(result.evidence.total,30);assert.equal(result.data.length,24);
 assert.deepEqual(result.data[0].factsOmitted,['amount']);assert.equal(result.coverage.partial,true);
 assert.equal(Object.hasOwn(result,'nextCursor'),false);
});

test('evidence: an empty stored window retains section statuses without inventing absence evidence',async()=>{
 const f=storedCase(evidenceId);f.state.page={...f.page,data:[],evidence:{total:0,returned:0,truncated:false},
  identityBasis:'unresolved_prospect',canonicalEntityId:null,canonicalName:null,
  sectionStates:[{section:'government_exposure',status:'empty_in_queried_scope',statusText:'Synthetic query only'}],
  coverage:{complete:true,partial:false,note:'No stored rows in this synthetic query.'}};
 const result=JSON.parse(await f.handler()(f.call())).result;
 assert.deepEqual(result,f.state.page);assert.equal(result.identityBasis,'unresolved_prospect');
 assert.equal(Object.hasOwn(result,'absenceEvidence'),false);
});

test('evidence: missing/revoked resource authority and incorrect scope refuse before source access',async()=>{
 for(const reason of ['missing_owner','revoked','foreign_client','forged_selector']){
  const f=storedCase(evidenceId),call=structuredClone(f.call());
  if(reason==='missing_owner'){
   const {credentialsForCall,...passive}=f.transport;
   const handler=createBusinessDevelopmentHandlers({...passive,now:f.now,getCredentials:()=>{throw Error('NO_STATIC_FALLBACK');}},[f.operation])[0];
   await assert.rejects(handler.execute(call),{message:'UNAVAILABLE'});
  }else{
   if(reason==='revoked')f.state.resourceDenied=true;
   if(reason==='foreign_client')call.authority.subject.scopes[0].resourceId='e1234567-b123-4c12-8d12-e123456789ab';
   if(reason==='forged_selector')call.request.clientId=clientId;
   await assert.rejects(f.handler()(call));
  }
  assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
});

test('evidence: personal scope and ordinary attended credentials cannot bypass the delegated prospect/client receipt',async()=>{
 const f=storedCase(evidenceId,{personal:true});
 await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});
 assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 const g=storedCase(evidenceId);g.state.credentialMutator=proof=>{proof.authorizationScheme='Bearer';};
 await assert.rejects(g.handler()(g.call()),{message:'UNAVAILABLE'});assert.equal(g.wire.length,0);
});

test('evidence: wrapped credential factories retain closed callback validation',async()=>{
 const f=storedCase(evidenceId);let effects=0;
 const proxy=new Proxy(async()=>({}),{apply(){effects++;throw Error('NO_PROXY_CALL');}});
 assert.throws(()=>createBusinessDevelopmentHandlers({...f.transport,now:f.now,credentialsForCall:proxy},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 const [handler]=createBusinessDevelopmentHandlers({...f.transport,now:f.now,credentialsForCall:()=>proxy},[f.operation]);
 await assert.rejects(handler.execute(f.call()),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(effects,0);assert.equal(f.wire.length,0);
});

test('evidence: source errors, malformed coverage, substituted citation aliases and private payloads withhold results',async()=>{
 for(const mutation of [page=>{page.data[0].id='foreign';},page=>{page.data[0].url='https://foreign.example.invalid';},
  page=>{page.data[0].facts.amount=999;page.evidence.returned=0;},page=>{page.coverage.partial=true;},
  page=>{page.data[0].privateSource={secret:'never-visible'};},page=>{page.data[0].facts.amount='x'.repeat(601);}]){
  const f=storedCase(evidenceId);f.state.resultMutator=mutation;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 for(const status of [403,404,503]){
  const f=storedCase(evidenceId);f.state.responseFactory=()=>Response.json({error:'Synthetic source failure'},{status});
  await assert.rejects(f.handler()(f.call()));assert.equal(f.wire.length,1);
 }
});

test('evidence: expired source credentials and cancellation refuse before HTTP, late expiration withholds bytes',async()=>{
 const f=storedCase(evidenceId);f.state.credentialMutator=p=>{p.authorizationScheme='CapiroMeriRead';p.expiresAtMs=f.now();};
 await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase(evidenceId),controller=new AbortController();controller.abort();
 await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});assert.equal(g.wire.length,0);
 const h=storedCase(evidenceId);h.state.afterSource=()=>{h.state.now=h.authority.deadlineMs;};
 await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});
});
